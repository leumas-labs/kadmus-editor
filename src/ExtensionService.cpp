#include "../include/ExtensionService.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <cstdlib>

namespace fs = std::filesystem;
using json = nlohmann::json;

ExtensionService::ExtensionService(const std::string& extensions_dir)
    : extensions_dir_(extensions_dir) {
    try {
        fs::create_directories(extensions_dir_);
    } catch (...) {}
}

ExtensionService::~ExtensionService() {}

std::vector<ExtensionInfo> ExtensionService::scan_extensions() {
    std::vector<ExtensionInfo> results;
    try {
        fs::path base_path(extensions_dir_);
        if (!fs::exists(base_path) || !fs::is_directory(base_path)) {
            return results;
        }

        for (const auto& entry : fs::directory_iterator(base_path)) {
            if (!entry.is_directory()) continue;

            fs::path pkg_path = entry.path() / "package.json";
            if (!fs::exists(pkg_path)) continue;

            try {
                std::ifstream file(pkg_path);
                if (!file.is_open()) continue;

                json pkg = json::parse(file);
                
                ExtensionInfo info;
                std::string publisher = pkg.value("publisher", "unknown");
                std::string name = pkg.value("name", "unknown");
                
                info.id = publisher + "." + name;
                info.name = pkg.value("displayName", name);
                info.version = pkg.value("version", "0.0.1");
                info.path = entry.path().string();
                info.contributions = pkg.value("contributes", json::object());

                results.push_back(info);
            } catch (const std::exception& e) {
                std::cerr << "[warning] Failed to parse package.json in " << entry.path() << ": " << e.what() << std::endl;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "[error] Failed to scan extensions directory: " << e.what() << std::endl;
    }
    return results;
}

bool ExtensionService::install_extension(const std::string& vsix_path) {
    try {
        fs::path vsix(vsix_path);
        if (!fs::exists(vsix) || !fs::is_regular_file(vsix)) {
            std::cerr << "[error] VSIX file does not exist: " << vsix_path << std::endl;
            return false;
        }

        fs::path base_path(extensions_dir_);
        fs::path temp_dir = base_path / "temp_extract";
        fs::create_directories(temp_dir);

        // 1. Unzip the VSIX file to the temp directory
        // Under Windows, we could call powershell Expand-Archive or a stub
        // Under Linux/macOS, we invoke the standard unzip utility
#ifdef _WIN32
        std::string cmd = "powershell -Command \"Expand-Archive -Path '" + vsix_path + "' -DestinationPath '" + temp_dir.string() + "' -Force\"";
#else
        std::string cmd = "unzip -o \"" + vsix_path + "\" -d \"" + temp_dir.string() + "\" > /dev/null 2>&1";
#endif

        int status = std::system(cmd.c_str());
        if (status != 0) {
            std::cerr << "[error] Extraction failed for VSIX: " << vsix_path << std::endl;
            fs::remove_all(temp_dir);
            return false;
        }

        // 2. Locate package.json in temp_extract/extension/
        fs::path pkg_path = temp_dir / "extension" / "package.json";
        if (!fs::exists(pkg_path)) {
            std::cerr << "[error] Invalid VSIX: package.json missing inside extension folder." << std::endl;
            fs::remove_all(temp_dir);
            return false;
        }

        // 3. Read package.json to determine destination name (publisher.name-version)
        std::ifstream file(pkg_path);
        json pkg = json::parse(file);
        
        std::string publisher = pkg.value("publisher", "unknown");
        std::string name = pkg.value("name", "unknown");
        std::string version = pkg.value("version", "0.0.1");
        
        std::string target_dir_name = publisher + "." + name + "-" + version;
        fs::path target_dir = base_path / target_dir_name;

        // Clean existing target if it exists
        if (fs::exists(target_dir)) {
            fs::remove_all(target_dir);
        }

        // 4. Move temp_extract/extension to extensions_dir/publisher.name-version
        fs::rename(temp_dir / "extension", target_dir);

        // 5. Clean up temporary extract folder
        fs::remove_all(temp_dir);

        std::cout << "[info] Extension successfully installed: " << target_dir_name << std::endl;
        return true;

    } catch (const std::exception& e) {
        std::cerr << "[error] Exception during extension installation: " << e.what() << std::endl;
        return false;
    }
}
