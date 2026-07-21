#pragma once

#include <string>
#include <vector>

struct GitStatusFile {
    std::string path;
    std::string status; // "U" (Untracked), "M" (Modified), "A" (Added), "D" (Deleted)
};

// Integrates native Git version control using libgit2
class GitService {
public:
    GitService();
    ~GitService();

    // Get list of modified and untracked files
    std::vector<GitStatusFile> get_status(const std::string& repo_path);

    // Get current branch name
    std::string get_branch(const std::string& repo_path);

    // Add a file to index (git add)
    bool stage_file(const std::string& repo_path, const std::string& file_path);

    // Commit changes
    bool commit(
        const std::string& repo_path,
        const std::string& message,
        const std::string& author_name,
        const std::string& author_email
    );
};
