#pragma once

#include <string>
#include <functional>
#include <memory>
#include <thread>
#include <vector>
#include <atomic>
#include <mutex>
#include <set>
#include "JSONRPCRouter.hpp"

#ifdef _WIN32
#include <winsock2.h>
#else
#include <sys/socket.h>
#include <netinet/in.h>
#endif

// A self-contained C++ WebSocket Server implementing RFC 6455
class WebSocketServer {
public:
    WebSocketServer(int port, std::shared_ptr<JSONRPCRouter> router, const std::string& connection_token = "");
    ~WebSocketServer();

    // Start the server socket listener (runs in a separate background thread)
    bool start();

    // Stop the server and cleanup sockets
    void stop();

    // Send a push message to a connected client
    void send_message(int client_fd, const std::string& message);

private:
    int port_;
    std::shared_ptr<JSONRPCRouter> router_;
    std::string connection_token_;
    std::atomic<bool> is_running_;
    std::thread listen_thread_;

#ifdef _WIN32
    SOCKET server_fd_;
#else
    int server_fd_;
#endif

    std::set<int> client_fds_;
    std::mutex clients_mutex_;

    void listen_loop();
    void handle_client(int client_fd);
    
    // Handshake helper
    bool perform_handshake(int client_fd, const std::string& request);
    
    // Frame helper
    std::string decode_frame(std::vector<uint8_t>& buffer, bool& is_close);
    std::vector<uint8_t> encode_frame(const std::string& payload);
};
