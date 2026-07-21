#include "../include/LanguageServerProtocol.hpp"
#include <iostream>
#include <cstring>
#include <filesystem>
#include <cstdlib>

#ifdef _WIN32
// Windows implementations (stubs)
LspSession::LspSession() {}
LspSession::~LspSession() {}
bool LspSession::start() { return false; }
void LspSession::write_message(const std::string& json_payload) {}
void LspSession::stop() {}
void LspSession::read_loop() {}
#else
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>

LspSession::LspSession() : pid(-1), stdin_fd(-1), stdout_fd(-1) {}
LspSession::~LspSession() {
    stop();
}

bool LspSession::start() {
    int in_pipe[2];
    int out_pipe[2];
    
    if (pipe(in_pipe) < 0 || pipe(out_pipe) < 0) {
        std::cerr << "[error] Failed to create pipes for LSP " << language << std::endl;
        return false;
    }
    
    pid_t p = fork();
    if (p < 0) {
        std::cerr << "[error] Failed to fork process for LSP " << language << std::endl;
        close(in_pipe[0]); close(in_pipe[1]);
        close(out_pipe[0]); close(out_pipe[1]);
        return false;
    }
    
    if (p == 0) {
        // Child process
        dup2(in_pipe[0], STDIN_FILENO);
        dup2(out_pipe[1], STDOUT_FILENO);
        
        close(in_pipe[1]);
        close(out_pipe[0]);
        
        // Suppress stderr to keep terminal logs clean unless desired
        int dev_null = open("/dev/null", O_WRONLY);
        if (dev_null >= 0) {
            dup2(dev_null, STDERR_FILENO);
            close(dev_null);
        }
        
        std::vector<const char*> exec_args;
        exec_args.push_back(binary_path.c_str());
        for (const auto& arg : args) {
            exec_args.push_back(arg.c_str());
        }
        exec_args.push_back(NULL);
        
        execvp(binary_path.c_str(), const_cast<char* const*>(exec_args.data()));
        std::cerr << "[error] Failed to exec LSP binary " << binary_path << ": " << strerror(errno) << std::endl;
        _exit(1);
    } else {
        // Parent process
        pid = p;
        stdin_fd = in_pipe[1];
        stdout_fd = out_pipe[0];
        
        close(in_pipe[0]);
        close(out_pipe[1]);
        
        is_running = true;
        read_thread = std::thread(&LspSession::read_loop, this);
        return true;
    }
}

void LspSession::write_message(const std::string& json_payload) {
    if (!is_running || stdin_fd == -1) return;
    std::string formatted = "Content-Length: " + std::to_string(json_payload.size()) + "\r\n\r\n" + json_payload;
    
    ssize_t bytes_written = ::write(stdin_fd, formatted.data(), formatted.size());
    (void)bytes_written;
}

void LspSession::stop() {
    if (is_running) {
        is_running = false;
        
        if (stdin_fd != -1) {
            ::close(stdin_fd);
            stdin_fd = -1;
        }
        if (stdout_fd != -1) {
            ::close(stdout_fd);
            stdout_fd = -1;
        }
        
        if (pid > 0) {
            kill(pid, SIGTERM);
            int status;
            waitpid(pid, &status, WNOHANG);
            pid = -1;
        }
        
        if (read_thread.joinable()) {
            read_thread.join();
        }
    }
}

void LspSession::read_loop() {
    std::string header_buffer;
    while (is_running && stdout_fd != -1) {
        char c;
        ssize_t bytes_read = read(stdout_fd, &c, 1);
        if (bytes_read <= 0) {
            break; 
        }
        
        header_buffer += c;
        
        if (header_buffer.size() >= 4 && header_buffer.substr(header_buffer.size() - 4) == "\r\n\r\n") {
            size_t pos = header_buffer.find("Content-Length:");
            if (pos == std::string::npos) {
                header_buffer.clear();
                continue;
            }
            
            size_t val_pos = pos + 15;
            size_t end_line = header_buffer.find("\r\n", val_pos);
            if (end_line == std::string::npos) {
                header_buffer.clear();
                continue;
            }
            
            std::string len_str = header_buffer.substr(val_pos, end_line - val_pos);
            len_str.erase(0, len_str.find_first_not_of(" \t"));
            len_str.erase(len_str.find_last_not_of(" \t") + 1);
            
            int content_length = 0;
            try {
                content_length = std::stoi(len_str);
            } catch (...) {
                header_buffer.clear();
                continue;
            }
            
            header_buffer.clear();
            
            std::vector<char> content(content_length + 1, 0);
            int bytes_to_read = content_length;
            int total_read = 0;
            while (total_read < content_length && is_running) {
                ssize_t n = read(stdout_fd, content.data() + total_read, bytes_to_read);
                if (n <= 0) {
                    break;
                }
                total_read += n;
                bytes_to_read -= n;
            }
            
            if (total_read == content_length) {
                std::string json_payload(content.data(), content_length);
                if (on_message_cb) {
                    on_message_cb(json_payload);
                }
            }
        }
    }
    is_running = false;
}
#endif

// =====================================================================
// LspService Implementation
// =====================================================================

LspService::LspService(std::shared_ptr<SettingsService> settings_service)
    : settings_service_(settings_service) {}

LspService::~LspService() {
    shutdown_all();
}

std::string LspService::resolve_binary(const std::string& language) {
    if (language == "python") {
        std::string custom_path = settings_service_->get_string_value({"linter", "python", "path"}, "");
        if (!custom_path.empty()) {
            return custom_path;
        }
        
        // Try checking standard local bin path as a fallback
        const char* home = std::getenv("HOME");
        if (home) {
            std::filesystem::path local_ruff = std::filesystem::path(home) / ".local" / "bin" / "ruff";
            if (std::filesystem::exists(local_ruff)) {
                return local_ruff.string();
            }
        }
        
        return "ruff";
    }
    return "";
}

std::vector<std::string> LspService::resolve_args(const std::string& language) {
    if (language == "python") {
        // "ruff server" starts ruff's built-in LSP server
        return {"server"};
    }
    return {};
}

bool LspService::initialize_server(const std::string& language, std::function<void(const std::string&)> on_message_cb) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // Check if session already exists and is running
    auto it = sessions_.find(language);
    if (it != sessions_.end()) {
        if (it->second->is_running) {
            return true;
        }
        it->second->stop();
        sessions_.erase(it);
    }
    
    std::string bin = resolve_binary(language);
    if (bin.empty()) return false;
    
    auto session = std::make_shared<LspSession>();
    session->language = language;
    session->binary_path = bin;
    session->args = resolve_args(language);
    session->on_message_cb = on_message_cb;
    
    if (session->start()) {
        sessions_[language] = session;
        std::cout << "[info] Started LSP server for " << language << " (" << bin << ")" << std::endl;
        return true;
    }
    
    return false;
}

bool LspService::send_message(const std::string& language, const std::string& json_payload) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sessions_.find(language);
    if (it != sessions_.end() && it->second->is_running) {
        it->second->write_message(json_payload);
        return true;
    }
    return false;
}

void LspService::shutdown_server(const std::string& language) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sessions_.find(language);
    if (it != sessions_.end()) {
        it->second->stop();
        sessions_.erase(it);
        std::cout << "[info] Shutdown LSP server for " << language << std::endl;
    }
}

void LspService::shutdown_all() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [lang, session] : sessions_) {
        session->stop();
    }
    sessions_.clear();
}
