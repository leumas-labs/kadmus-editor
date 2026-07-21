#pragma once
#include <string>
#include <vector>
#include <mutex>
#include <thread>
#include <map>
#include <functional>
#include <memory>
#include <atomic>
#include <nlohmann/json.hpp>
#include "SettingsService.hpp"

struct LspSession {
    std::string language;
    std::string binary_path;
    std::vector<std::string> args;
    
    std::atomic<bool> is_running{false};
    std::thread read_thread;
    
#ifdef _WIN32
    // Windows fields (stubs)
#else
    pid_t pid{-1};
    int stdin_fd{-1};
    int stdout_fd{-1};
#endif

    std::function<void(const std::string&)> on_message_cb;
    
    LspSession();
    ~LspSession();
    bool start();
    void write_message(const std::string& json_payload);
    void stop();
    void read_loop();
};

class LspService {
public:
    LspService(std::shared_ptr<SettingsService> settings_service);
    ~LspService();

    bool initialize_server(const std::string& language, std::function<void(const std::string&)> on_message_cb);
    bool send_message(const std::string& language, const std::string& json_payload);
    void shutdown_server(const std::string& language);
    void shutdown_all();

private:
    std::shared_ptr<SettingsService> settings_service_;
    std::map<std::string, std::shared_ptr<LspSession>> sessions_;
    std::mutex mutex_;
    
    std::string resolve_binary(const std::string& language);
    std::vector<std::string> resolve_args(const std::string& language);
};
