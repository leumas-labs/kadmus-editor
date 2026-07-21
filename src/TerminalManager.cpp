#include "../include/TerminalManager.hpp"
#include <iostream>
#include <cstring>

#ifdef _WIN32
// Windows headers and stubs
void TerminalSession::read_loop() {
    // Windows implementation of reading from pipe
}
TerminalSession::TerminalSession(int id, const std::string& shell, std::function<void(int, const std::string&)> on_output)
    : id_(id), shell_(shell), on_output_cb_(on_output), is_running_(false) {}

TerminalSession::~TerminalSession() {
    close();
}

bool TerminalSession::start() {
    std::cerr << "Windows Terminal session not fully implemented in prototype yet (requires Windows 10 ConPTY APIs)" << std::endl;
    return false;
}

void TerminalSession::write(const std::string& data) {}
void TerminalSession::resize(int cols, int rows) {}
void TerminalSession::close() {}

#else

// POSIX implementation (Linux / macOS)
#include <sys/ioctl.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/wait.h>

#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

TerminalSession::TerminalSession(int id, const std::string& shell, std::function<void(int, const std::string&)> on_output)
    : id_(id), shell_(shell), on_output_cb_(on_output), is_running_(false), pid_(-1), pty_master_fd_(-1) {}

TerminalSession::~TerminalSession() {
    close();
}

bool TerminalSession::start() {
    int master_fd;
    pid_t pid = forkpty(&master_fd, NULL, NULL, NULL);

    if (pid < 0) {
        std::cerr << "Failed to fork pseudoterminal." << std::endl;
        return false;
    }

    if (pid == 0) {
        // Child Process
        // Set environment variables
        setenv("TERM", "xterm-256color", 1);
        
        // Execute shell
        const char* shell_path = shell_.c_str();
        execl(shell_path, shell_path, (char*)NULL);
        
        // If execution fails, exit immediately
        std::cerr << "Failed to execute shell: " << shell_ << std::endl;
        _exit(1);
    } else {
        // Parent Process
        pid_ = pid;
        pty_master_fd_ = master_fd;
        is_running_ = true;

        // Spawn reading thread
        read_thread_ = std::thread(&TerminalSession::read_loop, this);
        return true;
    }
}

void TerminalSession::write(const std::string& data) {
    if (is_running_ && pty_master_fd_ != -1) {
        auto bytes_written = ::write(pty_master_fd_, data.data(), data.size());
        (void)bytes_written;
    }
}

void TerminalSession::resize(int cols, int rows) {
    if (is_running_ && pty_master_fd_ != -1) {
        struct winsize ws;
        ws.ws_col = cols;
        ws.ws_row = rows;
        ws.ws_xpixel = 0;
        ws.ws_ypixel = 0;
        ioctl(pty_master_fd_, TIOCSWINSZ, &ws);
    }
}

void TerminalSession::close() {
    if (is_running_) {
        is_running_ = false;
        
        if (pty_master_fd_ != -1) {
            ::close(pty_master_fd_);
            pty_master_fd_ = -1;
        }

        if (pid_ > 0) {
            int status;
            kill(pid_, SIGTERM);
            waitpid(pid_, &status, WNOHANG);
            pid_ = -1;
        }

        if (read_thread_.joinable()) {
            read_thread_.join();
        }
    }
}

void TerminalSession::read_loop() {
    char buffer[2048];
    while (is_running_ && pty_master_fd_ != -1) {
        ssize_t bytes_read = read(pty_master_fd_, buffer, sizeof(buffer) - 1);
        if (bytes_read <= 0) {
            // Error or terminal closed
            break;
        }
        buffer[bytes_read] = '\0';
        std::string output(buffer, bytes_read);
        on_output_cb_(id_, output);
    }
    
    // Auto shutdown session on shell exit
    is_running_ = false;
}

#endif


// =====================================================================
// TerminalManager Implementation
// =====================================================================

TerminalManager::TerminalManager() : next_session_id_(0) {}

TerminalManager::~TerminalManager() {
    sessions_.clear(); // Unique pointers automatically destroy the sessions and call close()
}

int TerminalManager::create_session(const std::string& shell, std::function<void(int, const std::string&)> on_output) {
    int id = next_session_id_++;
    
    // Resolve shell path under Linux/macOS
    std::string resolved_shell = shell;
#ifndef _WIN32
    if (resolved_shell == "zsh" && access("/bin/zsh", X_OK) == 0) {
        resolved_shell = "/bin/zsh";
    } else if (resolved_shell == "bash" && access("/bin/bash", X_OK) == 0) {
        resolved_shell = "/bin/bash";
    } else {
        resolved_shell = "/bin/sh"; // Safest fallback
    }
#endif

    auto session = std::make_unique<TerminalSession>(id, resolved_shell, on_output);
    if (session->start()) {
        sessions_[id] = std::move(session);
        return id;
    }
    return -1;
}

bool TerminalManager::write_session(int id, const std::string& data) {
    auto it = sessions_.find(id);
    if (it != sessions_.end()) {
        it->second->write(data);
        return true;
    }
    return false;
}

bool TerminalManager::resize_session(int id, int cols, int rows) {
    auto it = sessions_.find(id);
    if (it != sessions_.end()) {
        it->second->resize(cols, rows);
        return true;
    }
    return false;
}

bool TerminalManager::close_session(int id) {
    auto it = sessions_.find(id);
    if (it != sessions_.end()) {
        sessions_.erase(it); // Erase will destroy unique_ptr, closing the PTY
        return true;
    }
    return false;
}
