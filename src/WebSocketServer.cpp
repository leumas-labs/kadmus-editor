#include "../include/WebSocketServer.hpp"
#include <iostream>
#include <sstream>
#include <cstring>
#include <vector>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#define close_socket closesocket
#else
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#define close_socket close
#endif

// =====================================================================
// SHA-1 and Base64 Helpers
// =====================================================================

#define SHA1_ROL(value, bits) (((value) << (bits)) | ((value) >> (32 - (bits))))

void sha1_hash(const std::string& str, unsigned char* hash) {
    uint32_t digest[5] = { 0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0 };
    
    std::vector<uint8_t> block;
    block.insert(block.end(), str.begin(), str.end());
    
    uint64_t orig_size = str.size() * 8;
    block.push_back(0x80);
    while ((block.size() + 8) % 64 != 0) {
        block.push_back(0x00);
    }
    for (int i = 7; i >= 0; --i) {
        block.push_back((orig_size >> (i * 8)) & 0xFF);
    }
    
    for (size_t offset = 0; offset < block.size(); offset += 64) {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i) {
            w[i] = (block[offset + i * 4] << 24) |
                   (block[offset + i * 4 + 1] << 16) |
                   (block[offset + i * 4 + 2] << 8) |
                   (block[offset + i * 4 + 3]);
        }
        for (int i = 16; i < 80; ++i) {
            w[i] = SHA1_ROL(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        }
        
        uint32_t a = digest[0];
        uint32_t b = digest[1];
        uint32_t c = digest[2];
        uint32_t d = digest[3];
        uint32_t e = digest[4];
        
        for (int i = 0; i < 80; ++i) {
            uint32_t f, k;
            if (i < 20) {
                f = (b & c) | (~b & d);
                k = 0x5A827999;
            } else if (i < 40) {
                f = b ^ c ^ d;
                k = 0x6ED9EBA1;
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8F1BBCDC;
            } else {
                f = b ^ c ^ d;
                k = 0xCA62C1D6;
            }
            uint32_t temp = SHA1_ROL(a, 5) + f + e + k + w[i];
            e = d;
            d = c;
            c = SHA1_ROL(b, 30);
            b = a;
            a = temp;
        }
        
        digest[0] += a;
        digest[1] += b;
        digest[2] += c;
        digest[3] += d;
        digest[4] += e;
    }
    
    for (int i = 0; i < 5; ++i) {
        hash[i * 4] = (digest[i] >> 24) & 0xFF;
        hash[i * 4 + 1] = (digest[i] >> 16) & 0xFF;
        hash[i * 4 + 2] = (digest[i] >> 8) & 0xFF;
        hash[i * 4 + 3] = digest[i] & 0xFF;
    }
}

std::string base64_encode(const unsigned char* src, size_t len) {
    const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out = "";
    int val = 0, valb = -6;
    for (size_t i = 0; i < len; ++i) {
        unsigned char c = src[i];
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            out.push_back(alphabet[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) out.push_back(alphabet[((val << 8) >> (valb + 8)) & 0x3F]);
    while (out.size() % 4) out.push_back('=');
    return out;
}

// =====================================================================
// WebSocketServer Implementation
// =====================================================================

WebSocketServer::WebSocketServer(int port, std::shared_ptr<JSONRPCRouter> router, const std::string& connection_token)
    : port_(port), router_(router), connection_token_(connection_token), is_running_(false), server_fd_(-1) {}

WebSocketServer::~WebSocketServer() {
    stop();
}

bool WebSocketServer::start() {
#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "WSAStartup failed." << std::endl;
        return false;
    }
#endif

    server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd_ < 0) {
        std::cerr << "Failed to create socket." << std::endl;
        return false;
    }

    // Allow address reuse
    int opt = 1;
#ifdef _WIN32
    setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in address;
    std::memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port_);

    if (bind(server_fd_, (struct sockaddr*)&address, sizeof(address)) < 0) {
        std::cerr << "Bind failed on port " << port_ << std::endl;
        close_socket(server_fd_);
        return false;
    }

    if (listen(server_fd_, 10) < 0) {
        std::cerr << "Listen failed." << std::endl;
        close_socket(server_fd_);
        return false;
    }

    is_running_ = true;
    listen_thread_ = std::thread(&WebSocketServer::listen_loop, this);
    std::cout << "CEBackend WebSocket Server running on port " << port_ << std::endl;
    return true;
}

void WebSocketServer::stop() {
    if (is_running_) {
        is_running_ = false;
        if (server_fd_ != -1) {
#ifdef _WIN32
            shutdown(server_fd_, SD_BOTH);
#else
            shutdown(server_fd_, SHUT_RDWR);
#endif
            close_socket(server_fd_);
            server_fd_ = -1;
        }

        {
            std::lock_guard<std::mutex> lock(clients_mutex_);
            for (int fd : client_fds_) {
                close_socket(fd);
            }
            client_fds_.clear();
        }

        if (listen_thread_.joinable()) {
            listen_thread_.join();
        }

        for (auto& t : client_threads_) {
            if (t.joinable()) {
                t.join();
            }
        }
        client_threads_.clear();

#ifdef _WIN32
        WSACleanup();
#endif
    }
}

void WebSocketServer::send_message(int client_fd, const std::string& message) {
    std::vector<uint8_t> frame = encode_frame(message);
    send(client_fd, (const char*)frame.data(), frame.size(), 0);
}

void WebSocketServer::listen_loop() {
    while (is_running_) {
        sockaddr_in client_addr;
        socklen_t addr_len = sizeof(client_addr);
        
        int client_fd = accept(server_fd_, (struct sockaddr*)&client_addr, &addr_len);
        if (client_fd < 0) {
            if (is_running_) {
                std::cerr << "Accept failed." << std::endl;
            }
            break;
        }

        // Spawn a thread to handle client messages
        client_threads_.push_back(std::thread(&WebSocketServer::handle_client, this, client_fd));
    }
}

void WebSocketServer::handle_client(int client_fd) {
    struct ClientGuard {
        WebSocketServer& server;
        int fd;
        ClientGuard(WebSocketServer& s, int f) : server(s), fd(f) {
            std::lock_guard<std::mutex> lock(server.clients_mutex_);
            server.client_fds_.insert(fd);
        }
        ~ClientGuard() {
            {
                std::lock_guard<std::mutex> lock(server.clients_mutex_);
                server.client_fds_.erase(fd);
            }
            close_socket(fd);
        }
    };

    ClientGuard guard(*this, client_fd);
    char buffer[4096];
    std::vector<uint8_t> raw_buffer;

    // 1. Read HTTP Handshake Request
    int bytes_received = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
    if (bytes_received <= 0) {
        return;
    }
    buffer[bytes_received] = '\0';

    if (!perform_handshake(client_fd, std::string(buffer))) {
        std::cerr << "Handshake failed." << std::endl;
        return;
    }

    // 2. Client Message Loop
    bool is_close = false;
    while (is_running_ && !is_close) {
        bytes_received = recv(client_fd, buffer, sizeof(buffer), 0);
        if (bytes_received <= 0) {
            break;
        }

        raw_buffer.insert(raw_buffer.end(), buffer, buffer + bytes_received);

        while (true) {
            bool frame_closed = false;
            std::string payload = decode_frame(raw_buffer, frame_closed);
            if (frame_closed) {
                is_close = true;
                break;
            }

            if (payload.empty() && raw_buffer.empty()) {
                // Not enough bytes for frame
                break;
            }

            if (!payload.empty()) {
                // Route message and send response
                std::string response = router_->handle_request(payload, [this, client_fd](const std::string& notif) {
                    this->send_message(client_fd, notif);
                });

                if (!response.empty()) {
                    send_message(client_fd, response);
                }
            }
            
            if (raw_buffer.empty()) break;
        }
    }
}

bool WebSocketServer::perform_handshake(int client_fd, const std::string& request) {
    // Validate Connection Token if configured
    if (!connection_token_.empty()) {
        size_t get_pos = request.find("GET ");
        if (get_pos != std::string::npos) {
            size_t end_get = request.find(" HTTP/", get_pos);
            if (end_get != std::string::npos) {
                std::string url = request.substr(get_pos + 4, end_get - (get_pos + 4));
                std::string token_param = "t=" + connection_token_;
                std::string recon_param = "reconnectionToken=" + connection_token_;
                if (url.find(token_param) == std::string::npos && url.find(recon_param) == std::string::npos) {
                    std::string forbidden_resp = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nUnauthorized: Invalid connection token.\r\n";
                    send(client_fd, forbidden_resp.data(), forbidden_resp.size(), 0);
                    std::cerr << "Unauthorized WebSocket connection attempt blocked (missing or invalid token)." << std::endl;
                    return false;
                }
            }
        }
    }

    std::string key_header = "Sec-WebSocket-Key: ";
    size_t key_pos = request.find(key_header);
    if (key_pos == std::string::npos) return false;

    size_t key_start = key_pos + key_header.size();
    size_t key_end = request.find("\r\n", key_start);
    std::string client_key = request.substr(key_start, key_end - key_start);

    // Magic GUID
    std::string accept_key = client_key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    unsigned char hash[20];
    sha1_hash(accept_key, hash);
    std::string base64_accept = base64_encode(hash, 20);

    // Send Handshake response
    std::stringstream response;
    response << "HTTP/1.1 101 Switching Protocols\r\n"
             << "Upgrade: websocket\r\n"
             << "Connection: Upgrade\r\n"
             << "Sec-WebSocket-Accept: " << base64_accept << "\r\n\r\n";

    std::string response_str = response.str();
    send(client_fd, response_str.data(), response_str.size(), 0);
    return true;
}

std::string WebSocketServer::decode_frame(std::vector<uint8_t>& buffer, bool& is_close) {
    if (buffer.size() < 2) return "";

    uint8_t byte0 = buffer[0];
    uint8_t byte1 = buffer[1];

    uint8_t opcode = byte0 & 0x0F;
    if (opcode == 0x08) { // Close frame
        is_close = true;
        buffer.clear();
        return "";
    }

    bool masked = (byte1 & 0x80) != 0;
    uint64_t payload_len = byte1 & 0x7F;

    size_t header_len = 2;
    if (payload_len == 126) {
        if (buffer.size() < 4) return "";
        payload_len = (buffer[2] << 8) | buffer[3];
        header_len = 4;
    } else if (payload_len == 127) {
        if (buffer.size() < 10) return "";
        payload_len = 0;
        for (int i = 0; i < 8; ++i) {
            payload_len = (payload_len << 8) | buffer[2 + i];
        }
        header_len = 10;
    }

    size_t mask_len = masked ? 4 : 0;
    if (buffer.size() < header_len + mask_len + payload_len) return ""; // Not fully loaded

    std::vector<uint8_t> mask_key(mask_len);
    if (masked) {
        std::copy(buffer.begin() + header_len, buffer.begin() + header_len + 4, mask_key.begin());
    }

    std::string payload = "";
    size_t payload_start = header_len + mask_len;
    for (size_t i = 0; i < payload_len; ++i) {
        uint8_t byte = buffer[payload_start + i];
        if (masked) {
            byte = byte ^ mask_key[i % 4];
        }
        payload.push_back(static_cast<char>(byte));
    }

    // Erase processed frame from buffer
    buffer.erase(buffer.begin(), buffer.begin() + payload_start + payload_len);

    return payload;
}

std::vector<uint8_t> WebSocketServer::encode_frame(const std::string& payload) {
    std::vector<uint8_t> frame;
    frame.push_back(0x81); // FIN = 1, Text opcode

    size_t len = payload.size();
    if (len <= 125) {
        frame.push_back(static_cast<uint8_t>(len));
    } else if (len <= 65535) {
        frame.push_back(126);
        frame.push_back((len >> 8) & 0xFF);
        frame.push_back(len & 0xFF);
    } else {
        frame.push_back(127);
        for (int i = 7; i >= 0; --i) {
            frame.push_back((len >> (i * 8)) & 0xFF);
        }
    }

    frame.insert(frame.end(), payload.begin(), payload.end());
    return frame;
}
