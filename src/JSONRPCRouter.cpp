#include "../include/JSONRPCRouter.hpp"
#include <nlohmann/json.hpp>
#include <iostream>

using json = nlohmann::json;

JSONRPCRouter::JSONRPCRouter(
    std::shared_ptr<FileSystemService> fs_service,
    std::shared_ptr<TerminalManager> term_manager,
    std::shared_ptr<AgentService> agent_service
) : fs_service_(fs_service), term_manager_(term_manager), agent_service_(agent_service) {}

JSONRPCRouter::~JSONRPCRouter() {}

std::string JSONRPCRouter::handle_request(const std::string& raw_json, std::function<void(const std::string&)> send_to_client_cb) {
    try {
        auto req = json::parse(raw_json);
        std::string method = req.value("method", "");
        json id = req.value("id", json(nullptr));

        // Helper to format responses
        auto make_response = [&id](const json& result, bool is_error = false) {
            json resp;
            resp["jsonrpc"] = "2.0";
            if (is_error) {
                resp["error"] = {{"code", -32603}, {"message", result}};
            } else {
                resp["result"] = result;
            }
            resp["id"] = id;
            return resp.dump();
        };

        if (method == "fs_list") {
            std::string path = req["params"].value("path", "");
            auto items = fs_service_->list_directory(path);
            
            json arr = json::array();
            for (const auto& item : items) {
                arr.push_back({
                    {"name", item.name},
                    {"path", item.path},
                    {"is_directory", item.is_directory},
                    {"size", item.size}
                });
            }
            return make_response(arr);
        }
        else if (method == "fs_read") {
            std::string path = req["params"].value("path", "");
            std::string content = fs_service_->read_file(path);
            return make_response(content);
        }
        else if (method == "fs_write") {
            std::string path = req["params"].value("path", "");
            std::string content = req["params"].value("content", "");
            bool success = fs_service_->write_file(path, content);
            return make_response(success);
        }
        else if (method == "term_create") {
            std::string shell = req["params"].value("shell", "bash");
            
            int session_id = term_manager_->create_session(shell, [send_to_client_cb](const std::string& data) {
                json notif;
                notif["jsonrpc"] = "2.0";
                notif["method"] = "term_output";
                notif["params"] = {{"data", data}};
                send_to_client_cb(notif.dump());
            });

            if (session_id < 0) {
                return make_response("Failed to create terminal session", true);
            }
            return make_response(session_id);
        }
        else if (method == "term_write") {
            int term_id = req["params"].value("id", -1);
            std::string data = req["params"].value("data", "");
            bool success = term_manager_->write_session(term_id, data);
            return make_response(success);
        }
        else if (method == "term_resize") {
            int term_id = req["params"].value("id", -1);
            int cols = req["params"].value("cols", 80);
            int rows = req["params"].value("rows", 24);
            bool success = term_manager_->resize_session(term_id, cols, rows);
            return make_response(success);
        }
        else if (method == "agent_send") {
            std::string session_id = req["params"].value("session_id", "");
            std::string message = req["params"].value("message", "");
            
            agent_service_->send_message(session_id, message, [send_to_client_cb, session_id](const std::string& reply) {
                json notif;
                notif["jsonrpc"] = "2.0";
                notif["method"] = "agent_reply";
                notif["params"] = {{"session_id", session_id}, {"message", reply}};
                send_to_client_cb(notif.dump());
            });
            
            return make_response(true);
        }

        return make_response("Method not found: " + method, true);

    } catch (const std::exception& e) {
        json resp;
        resp["jsonrpc"] = "2.0";
        resp["error"] = {{"code", -32700}, {"message", std::string("Parse error: ") + e.what()}};
        resp["id"] = nullptr;
        return resp.dump();
    }
}
