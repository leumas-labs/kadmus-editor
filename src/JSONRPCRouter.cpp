#include "../include/JSONRPCRouter.hpp"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <cstdio>

// Helper to escape strings for JSON output
std::string escape_json_string(const std::string& s) {
    std::string res = "\"";
    for (char c : s) {
        if (c == '"') res += "\\\"";
        else if (c == '\\') res += "\\\\";
        else if (c == '\n') res += "\\n";
        else if (c == '\r') res += "\\r";
        else if (c == '\t') res += "\\t";
        else if (c >= 0 && c < 32) {
            char buf[8];
            snprintf(buf, sizeof(buf), "\\u%04x", c);
            res += buf;
        } else {
            res += c;
        }
    }
    res += "\"";
    return res;
}

// Simple JSON extraction helpers
std::string get_string_field(const std::string& json, const std::string& key) {
    size_t pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    pos = json.find(":", pos);
    if (pos == std::string::npos) return "";
    size_t start = json.find("\"", pos);
    if (start == std::string::npos) return "";
    
    std::string val = "";
    bool escaped = false;
    for (size_t i = start + 1; i < json.size(); ++i) {
        char c = json[i];
        if (escaped) {
            if (c == 'n') val += '\n';
            else if (c == 't') val += '\t';
            else if (c == 'r') val += '\r';
            else val += c;
            escaped = false;
        } else {
            if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                break; // End of string
            } else {
                val += c;
            }
        }
    }
    return val;
}

int get_int_field(const std::string& json, const std::string& key) {
    size_t pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return -1;
    pos = json.find(":", pos);
    if (pos == std::string::npos) return -1;
    
    // Find first digit
    size_t start = json.find_first_of("0123456789-", pos);
    if (start == std::string::npos) return -1;
    
    size_t end = json.find_first_not_of("0123456789", start + 1);
    std::string num_str = json.substr(start, end - start);
    try {
        return std::stoi(num_str);
    } catch (...) {
        return -1;
    }
}

std::string make_response(const std::string& id, const std::string& result, bool is_error = false) {
    if (is_error) {
        return "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32603,\"message\":" + escape_json_string(result) + "},\"id\":" + id + "}";
    }
    return "{\"jsonrpc\":\"2.0\",\"result\":" + result + ",\"id\":" + id + "}";
}

JSONRPCRouter::JSONRPCRouter(
    std::shared_ptr<FileSystemService> fs_service,
    std::shared_ptr<TerminalManager> term_manager,
    std::shared_ptr<AgentService> agent_service
) : fs_service_(fs_service), term_manager_(term_manager), agent_service_(agent_service) {}

JSONRPCRouter::~JSONRPCRouter() {}

std::string JSONRPCRouter::handle_request(const std::string& raw_json, std::function<void(const std::string&)> send_to_client_cb) {
    std::string method = get_string_field(raw_json, "method");
    std::string id = "\"null\"";
    
    size_t id_pos = raw_json.find("\"id\"");
    if (id_pos != std::string::npos) {
        size_t colon_pos = raw_json.find(":", id_pos);
        if (colon_pos != std::string::npos) {
            size_t val_start = raw_json.find_first_not_of(" \t", colon_pos + 1);
            size_t val_end = raw_json.find_first_of(",}", val_start);
            id = raw_json.substr(val_start, val_end - val_start);
        }
    }

    if (method == "fs_list") {
        std::string path = get_string_field(raw_json, "path");
        auto items = fs_service_->list_directory(path);
        
        std::stringstream ss;
        ss << "[";
        for (size_t i = 0; i < items.size(); ++i) {
            ss << "{"
               << "\"name\":" << escape_json_string(items[i].name) << ","
               << "\"path\":" << escape_json_string(items[i].path) << ","
               << "\"is_directory\":" << (items[i].is_directory ? "true" : "false") << ","
               << "\"size\":" << items[i].size
               << "}";
            if (i < items.size() - 1) ss << ",";
        }
        ss << "]";
        return make_response(id, ss.str());
    }
    else if (method == "fs_read") {
        std::string path = get_string_field(raw_json, "path");
        std::string content = fs_service_->read_file(path);
        return make_response(id, escape_json_string(content));
    }
    else if (method == "fs_write") {
        std::string path = get_string_field(raw_json, "path");
        std::string content = get_string_field(raw_json, "content");
        bool success = fs_service_->write_file(path, content);
        return make_response(id, success ? "true" : "false");
    }
    else if (method == "term_create") {
        std::string shell = get_string_field(raw_json, "shell");
        if (shell.empty()) shell = "bash"; // Fallback default
        
        // Lambda capture variables for PTY output callbacks
        int session_id = term_manager_->create_session(shell, [send_to_client_cb](const std::string& data) {
            // Asynchronous PTY output notification
            std::string escaped_data = escape_json_string(data);
            std::string notif = "{\"jsonrpc\":\"2.0\",\"method\":\"term_output\",\"params\":{\"data\":" + escaped_data + "}}";
            send_to_client_cb(notif);
        });

        if (session_id < 0) {
            return make_response(id, "Failed to create terminal session", true);
        }
        return make_response(id, std::to_string(session_id));
    }
    else if (method == "term_write") {
        int term_id = get_int_field(raw_json, "id");
        std::string data = get_string_field(raw_json, "data");
        bool success = term_manager_->write_session(term_id, data);
        return make_response(id, success ? "true" : "false");
    }
    else if (method == "term_resize") {
        int term_id = get_int_field(raw_json, "id");
        int cols = get_int_field(raw_json, "cols");
        int rows = get_int_field(raw_json, "rows");
        bool success = term_manager_->resize_session(term_id, cols, rows);
        return make_response(id, success ? "true" : "false");
    }
    else if (method == "agent_send") {
        std::string session_id = get_string_field(raw_json, "session_id");
        std::string message = get_string_field(raw_json, "message");
        
        agent_service_->send_message(session_id, message, [send_to_client_cb, session_id](const std::string& reply) {
            // Asynchronous agent reply notification
            std::string escaped_reply = escape_json_string(reply);
            std::string notif = "{\"jsonrpc\":\"2.0\",\"method\":\"agent_reply\",\"params\":{\"session_id\":\"" + session_id + "\",\"message\":" + escaped_reply + "}}";
            send_to_client_cb(notif);
        });
        
        return make_response(id, "true"); // Acknowledge message received
    }
    
    return make_response(id, "Method not found: " + method, true);
}
