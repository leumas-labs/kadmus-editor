#include "../include/SettingsService.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>

namespace fs = std::filesystem;

SettingsService::SettingsService(const std::string& settings_dir) {
    fs::path dir(settings_dir);
    try {
        fs::create_directories(dir);
    } catch (...) {}
    
    settings_path_ = (dir / "settings.json").string();
    load_defaults();
    load_from_file();
}

SettingsService::~SettingsService() {}

void SettingsService::load_defaults() {
    current_settings_ = nlohmann::json::object();
    
    current_settings_["theme"] = {
        {"name", "azure"},
        {"transparency", true}
    };
    current_settings_["editor"] = {
        {"fontSize", 14},
        {"tabSize", 4},
        {"insertSpaces", true},
        {"wordWrap", "off"},
        {"renderWhitespace", "none"},
        {"minimap", {
            {"visible", true}
        }}
    };
    current_settings_["linter"] = {
        {"python", {
            {"enabled", true},
            {"provider", "ruff"},
            {"path", ""}
        }}
    };
    current_settings_["terminal"] = {
        {"shell", "/bin/bash"},
        {"fontSize", 12},
        {"scrollback", 1000}
    };
    current_settings_["ai"] = {
        {"enabled", true},
        {"provider", "mock"},
        {"endpoint", ""}
    };
}

void SettingsService::load_from_file() {
    try {
        if (!fs::exists(settings_path_)) {
            save_to_file();
            return;
        }

        std::ifstream file(settings_path_);
        if (!file.is_open()) return;

        nlohmann::json file_settings = nlohmann::json::parse(file);
        
        // Deep merge top-level keys to ensure default keys remain if missing in file
        for (auto& [key, value] : file_settings.items()) {
            if (current_settings_.contains(key) && current_settings_[key].is_object() && value.is_object()) {
                current_settings_[key].merge_patch(value);
            } else {
                current_settings_[key] = value;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "[warning] Failed to parse settings.json: " << e.what() << std::endl;
        // Fallback to saving defaults
        save_to_file();
    }
}

void SettingsService::save_to_file() {
    try {
        std::ofstream file(settings_path_);
        if (file.is_open()) {
            file << current_settings_.dump(2);
        }
    } catch (const std::exception& e) {
        std::cerr << "[error] Failed to write settings.json: " << e.what() << std::endl;
    }
}

nlohmann::json SettingsService::get_settings() {
    std::lock_guard<std::mutex> lock(mutex_);
    return current_settings_;
}

bool SettingsService::set_settings(const nlohmann::json& new_settings) {
    std::lock_guard<std::mutex> lock(mutex_);
    try {
        // Deep merge instead of complete override to preserve other keys
        if (new_settings.is_object()) {
            for (auto& [key, value] : new_settings.items()) {
                if (current_settings_.contains(key) && current_settings_[key].is_object() && value.is_object()) {
                    current_settings_[key].merge_patch(value);
                } else {
                    current_settings_[key] = value;
                }
            }
            save_to_file();
            return true;
        }
    } catch (...) {}
    return false;
}

std::string SettingsService::get_string_value(const std::vector<std::string>& path, const std::string& default_val) {
    std::lock_guard<std::mutex> lock(mutex_);
    nlohmann::json current = current_settings_;
    for (const auto& key : path) {
        if (current.is_object() && current.contains(key)) {
            current = current[key];
        } else {
            return default_val;
        }
    }
    return current.is_string() ? current.get<std::string>() : default_val;
}

int SettingsService::get_int_value(const std::vector<std::string>& path, int default_val) {
    std::lock_guard<std::mutex> lock(mutex_);
    nlohmann::json current = current_settings_;
    for (const auto& key : path) {
        if (current.is_object() && current.contains(key)) {
            current = current[key];
        } else {
            return default_val;
        }
    }
    return current.is_number_integer() ? current.get<int>() : default_val;
}

bool SettingsService::get_bool_value(const std::vector<std::string>& path, bool default_val) {
    std::lock_guard<std::mutex> lock(mutex_);
    nlohmann::json current = current_settings_;
    for (const auto& key : path) {
        if (current.is_object() && current.contains(key)) {
            current = current[key];
        } else {
            return default_val;
        }
    }
    return current.is_boolean() ? current.get<bool>() : default_val;
}
