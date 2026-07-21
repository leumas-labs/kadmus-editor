#pragma once

#include <string>
#include <vector>
#include <memory>
#include <map>
#include <functional>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/types.h>
#include <unistd.h>
#endif

// Represents a single native terminal session
class TerminalSession {
public:
    TerminalSession(int id, const std::string& shell, std::function<void(int, const std::string&)> on_output);
    ~TerminalSession();

    bool start();
    void write(const std::string& data);
    void resize(int cols, int rows);
    void close();

    int get_id() const { return id_; }

private:
    int id_;
    std::string shell_;
    std::function<void(int, const std::string&)> on_output_cb_;
    bool is_running_;
    std::thread read_thread_;

#ifdef _WIN32
    HPCON hPC_ = INVALID_HANDLE_VALUE;
    HANDLE hProcess_ = INVALID_HANDLE_VALUE;
    HANDLE hThread_ = INVALID_HANDLE_VALUE;
    HANDLE hPipeIn_ = INVALID_HANDLE_VALUE;
    HANDLE hPipeOut_ = INVALID_HANDLE_VALUE;
    void read_loop();
#else
    pid_t pid_ = -1;
    int pty_master_fd_ = -1;
    void read_loop();
#endif
};

// Manages all active terminal sessions in a cross-platform manner
class TerminalManager {
public:
    TerminalManager();
    ~TerminalManager();

    // Create a new session and return its session ID
    int create_session(const std::string& shell, std::function<void(int, const std::string&)> on_output);
    
    // Write data to a session
    bool write_session(int id, const std::string& data);
    
    // Resize a terminal session
    bool resize_session(int id, int cols, int rows);
    
    // Close a session
    bool close_session(int id);

private:
    int next_session_id_;
    std::map<int, std::unique_ptr<TerminalSession>> sessions_;
};
