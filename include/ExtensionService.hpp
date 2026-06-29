#pragma once

#include <string>
#include <vector>
#include <nlohmann/json.hpp>

struct ExtensionInfo {
    std::string id;
    std::string name;
    std::string version;
    std::string path;
    nlohmann::json contributions;
};

// Manages scanning, parsing, and installing VS Code extensions (VSIX)
class ExtensionService {
public:
    ExtensionService(const std::string& extensions_dir);
    ~ExtensionService();

    // Scan directory and parse package.json files
    std::vector<ExtensionInfo> scan_extensions();

    // Install extension from .vsix path by extracting it
    bool install_extension(const std::string& vsix_path);

private:
    std::string extensions_dir_;
};
