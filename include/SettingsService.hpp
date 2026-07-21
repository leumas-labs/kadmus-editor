#pragma once
#include <string>
#include <vector>
#include <mutex>
#include <nlohmann/json.hpp>

class SettingsService {
public:
    SettingsService(const std::string& settings_dir);
    ~SettingsService();

    nlohmann::json get_settings();
    bool set_settings(const nlohmann::json& new_settings);
    
    // Thread-safe helpers to fetch values dynamically from C++ backend
    std::string get_string_value(const std::vector<std::string>& path, const std::string& default_val);
    int get_int_value(const std::vector<std::string>& path, int default_val);
    bool get_bool_value(const std::vector<std::string>& path, bool default_val);

private:
    std::string settings_path_;
    nlohmann::json current_settings_;
    std::mutex mutex_;

    void load_defaults();
    void load_from_file();
    void save_to_file();
};
