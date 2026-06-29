#pragma once

#include <string>
#include <vector>
#include <filesystem>

struct FileInfo {
    std::string name;
    std::string path;
    bool is_directory;
    uintmax_t size;
};

// Manages all local filesystem requests using std::filesystem (C++17)
class FileSystemService {
public:
    FileSystemService(const std::string& workspace_root);
    ~FileSystemService();

    // Verify if path is within workspace boundaries
    bool is_safe_path(const std::string& path);

    // List all files and folders in directory
    std::vector<FileInfo> list_directory(const std::string& path);

    // Read entire file content into string
    std::string read_file(const std::string& path);

    // Write content into file (creates file if not exists)
    bool write_file(const std::string& path, const std::string& content);

private:
    std::filesystem::path workspace_root_;
};
