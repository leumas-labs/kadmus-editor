#include "../include/FileSystemService.hpp"
#include <fstream>
#include <sstream>
#include <iostream>

namespace fs = std::filesystem;

FileSystemService::FileSystemService(const std::string& workspace_root) {
    try {
        workspace_root_ = fs::absolute(workspace_root);
        std::cout << "FileSystem Workspace Root: " << workspace_root_ << std::endl;
    } catch (...) {
        workspace_root_ = fs::current_path();
    }
}

FileSystemService::~FileSystemService() {}

bool FileSystemService::is_safe_path(const std::string& path) {
    try {
        fs::path abs_path = fs::absolute(path);
        fs::path abs_root = fs::absolute(workspace_root_);
        
        // Find relative path from root to target
        auto rel = fs::relative(abs_path, abs_root);
        
        // If it starts with ".." it means it climbed out of the workspace root!
        if (!rel.empty() && rel.string().find("..") == 0) {
            return false;
        }
        return true;
    } catch (...) {
        return false;
    }
}

std::vector<FileInfo> FileSystemService::list_directory(const std::string& path) {
    std::vector<FileInfo> result;
    if (!is_safe_path(path)) {
        std::cerr << "Access denied (path traversal blocked): " << path << std::endl;
        return result;
    }

    try {
        fs::path p(path);
        if (!fs::exists(p) || !fs::is_directory(p)) {
            std::cerr << "Path is not a valid directory: " << path << std::endl;
            return result;
        }

        for (const auto& entry : fs::directory_iterator(p)) {
            FileInfo info;
            info.name = entry.path().filename().string();
            info.path = entry.path().string();
            info.is_directory = entry.is_directory();
            
            if (entry.is_regular_file()) {
                info.size = entry.file_size();
            } else {
                info.size = 0;
            }
            result.push_back(info);
        }
    } catch (const fs::filesystem_error& e) {
        std::cerr << "Filesystem error in list_directory: " << e.what() << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error in list_directory: " << e.what() << std::endl;
    }
    return result;
}

std::string FileSystemService::read_file(const std::string& path) {
    if (!is_safe_path(path)) {
        std::cerr << "Access denied (path traversal blocked): " << path << std::endl;
        return "";
    }

    try {
        fs::path p(path);
        if (!fs::exists(p) || !fs::is_regular_file(p)) {
            std::cerr << "Path is not a valid readable file: " << path << std::endl;
            return "";
        }

        std::ifstream file(path, std::ios::in | std::ios::binary);
        if (!file.is_open()) {
            std::cerr << "Failed to open file for reading: " << path << std::endl;
            return "";
        }

        std::ostringstream ss;
        ss << file.rdbuf();
        return ss.str();
    } catch (const std::exception& e) {
        std::cerr << "Error in read_file: " << e.what() << std::endl;
        return "";
    }
}

bool FileSystemService::write_file(const std::string& path, const std::string& content) {
    if (!is_safe_path(path)) {
        std::cerr << "Access denied (path traversal blocked): " << path << std::endl;
        return false;
    }

    try {
        fs::path p(path);
        // Ensure parent directory exists
        if (p.has_parent_path()) {
            fs::create_directories(p.parent_path());
        }

        std::ofstream file(path, std::ios::out | std::ios::binary | std::ios::trunc);
        if (!file.is_open()) {
            std::cerr << "Failed to open file for writing: " << path << std::endl;
            return false;
        }

        file.write(content.data(), content.size());
        return file.good();
    } catch (const std::exception& e) {
        std::cerr << "Error in write_file: " << e.what() << std::endl;
        return false;
    }
}
