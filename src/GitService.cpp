#include "../include/GitService.hpp"
#include <git2.h>
#include <iostream>

GitService::GitService() {
    git_libgit2_init();
}

GitService::~GitService() {
    git_libgit2_shutdown();
}

std::vector<GitStatusFile> GitService::get_status(const std::string& repo_path) {
    std::vector<GitStatusFile> results;
    git_repository* repo = nullptr;

    int error = git_repository_open(&repo, repo_path.c_str());
    if (error < 0) {
        const git_error* e = git_error_last();
        std::cerr << "Failed to open Git repository: " << (e ? e->message : "Unknown error") << std::endl;
        return results;
    }

    git_status_options opts = GIT_STATUS_OPTIONS_INIT;
    opts.show = GIT_STATUS_SHOW_INDEX_AND_WORKDIR;
    opts.flags = GIT_STATUS_OPT_INCLUDE_UNTRACKED | GIT_STATUS_OPT_RECURSE_UNTRACKED_DIRS;

    git_status_list* status_list = nullptr;
    error = git_status_list_new(&status_list, repo, &opts);
    if (error < 0) {
        git_repository_free(repo);
        return results;
    }

    size_t count = git_status_list_entrycount(status_list);
    for (size_t i = 0; i < count; ++i) {
        const git_status_entry* entry = git_status_byindex(status_list, i);
        GitStatusFile item;

        if (entry->head_to_index) {
            item.path = entry->head_to_index->new_file.path;
        } else if (entry->index_to_workdir) {
            item.path = entry->index_to_workdir->new_file.path;
        } else {
            continue;
        }

        if (entry->status & GIT_STATUS_WT_NEW) {
            item.status = "U"; // Untracked
        } else if (entry->status & (GIT_STATUS_WT_MODIFIED | GIT_STATUS_INDEX_MODIFIED)) {
            item.status = "M"; // Modified
        } else if (entry->status & GIT_STATUS_INDEX_NEW) {
            item.status = "A"; // Added
        } else if (entry->status & (GIT_STATUS_WT_DELETED | GIT_STATUS_INDEX_DELETED)) {
            item.status = "D"; // Deleted
        } else {
            continue;
        }

        results.push_back(item);
    }

    git_status_list_free(status_list);
    git_repository_free(repo);
    return results;
}

bool GitService::stage_file(const std::string& repo_path, const std::string& file_path) {
    git_repository* repo = nullptr;
    int error = git_repository_open(&repo, repo_path.c_str());
    if (error < 0) return false;

    git_index* index = nullptr;
    error = git_repository_index(&index, repo);
    if (error < 0) {
        git_repository_free(repo);
        return false;
    }

    error = git_index_add_bypath(index, file_path.c_str());
    if (error == 0) {
        error = git_index_write(index);
    }

    git_index_free(index);
    git_repository_free(repo);
    return error == 0;
}

bool GitService::commit(
    const std::string& repo_path,
    const std::string& message,
    const std::string& author_name,
    const std::string& author_email
) {
    git_repository* repo = nullptr;
    int error = git_repository_open(&repo, repo_path.c_str());
    if (error < 0) return false;

    // 1. Get index and write index to tree
    git_index* index = nullptr;
    error = git_repository_index(&index, repo);
    if (error < 0) {
        git_repository_free(repo);
        return false;
    }

    git_oid tree_id;
    error = git_index_write_tree(&tree_id, index);
    git_index_free(index);
    if (error < 0) {
        git_repository_free(repo);
        return false;
    }

    git_tree* tree = nullptr;
    error = git_tree_lookup(&tree, repo, &tree_id);
    if (error < 0) {
        git_repository_free(repo);
        return false;
    }

    // 2. Create Signature
    git_signature* sig = nullptr;
    error = git_signature_now(&sig, author_name.c_str(), author_email.c_str());
    if (error < 0) {
        git_tree_free(tree);
        git_repository_free(repo);
        return false;
    }

    // 3. Get Parent Commit (HEAD)
    git_oid parent_id;
    git_commit* parent = nullptr;
    int parent_count = 0;

    error = git_reference_name_to_id(&parent_id, repo, "HEAD");
    if (error == 0) {
        error = git_commit_lookup(&parent, repo, &parent_id);
        if (error == 0) {
            parent_count = 1;
        }
    }

    // 4. Create Commit
    git_oid commit_id;
    const git_commit* parents[1] = { parent };
    error = git_commit_create_v(
        &commit_id, repo, "HEAD", sig, sig,
        NULL, message.c_str(), tree, parent_count, parent
    );

    if (parent) git_commit_free(parent);
    git_signature_free(sig);
    git_tree_free(tree);
    git_repository_free(repo);

    return error == 0;
}
