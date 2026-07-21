#include "../include/JSONRPCRouter.hpp"
#include <nlohmann/json.hpp>
#include <iostream>

using json = nlohmann::json;

JSONRPCRouter::JSONRPCRouter(
    std::shared_ptr<FileSystemService> fs_service,
    std::shared_ptr<TerminalManager> term_manager,
    std::shared_ptr<AgentService> agent_service,
    std::shared_ptr<GitService> git_service,
    std::shared_ptr<ExtensionService> ext_service,
    std::shared_ptr<SettingsService> settings_service,
    std::shared_ptr<LspService> lsp_service
) : fs_service_(fs_service), term_manager_(term_manager), agent_service_(agent_service), git_service_(git_service), ext_service_(ext_service), settings_service_(settings_service), lsp_service_(lsp_service) {}

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
            return resp.dump(-1, ' ', false, json::error_handler_t::replace);
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
            
            int session_id = term_manager_->create_session(shell, [send_to_client_cb](int id, const std::string& data) {
                json notif;
                notif["jsonrpc"] = "2.0";
                notif["method"] = "term_output";
                notif["params"] = {{"id", id}, {"data", data}};
                send_to_client_cb(notif.dump(-1, ' ', false, json::error_handler_t::replace));
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
        else if (method == "term_close") {
            int term_id = req["params"].value("id", -1);
            bool success = term_manager_->close_session(term_id);
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
                send_to_client_cb(notif.dump(-1, ' ', false, json::error_handler_t::replace));
            });
            
            return make_response(true);
        }
        else if (method == "git_status") {
            std::string repo_path = req["params"].value("repo_path", "");
            auto files = git_service_->get_status(repo_path);
            json arr = json::array();
            for (const auto& file : files) {
                arr.push_back({
                    {"path", file.path},
                    {"status", file.status}
                });
            }
            return make_response(arr);
        }
        else if (method == "git_branch") {
            std::string repo_path = req["params"].value("repo_path", "");
            std::string branch = git_service_->get_branch(repo_path);
            return make_response(branch);
        }
        else if (method == "window_minimize") {
            extern void trigger_window_minimize();
            trigger_window_minimize();
            return make_response(true);
        }
        else if (method == "window_maximize") {
            extern void trigger_window_maximize();
            trigger_window_maximize();
            return make_response(true);
        }
        else if (method == "window_close") {
            extern void trigger_window_close();
            trigger_window_close();
            return make_response(true);
        }
        else if (method == "window_drag") {
            extern void trigger_window_drag();
            trigger_window_drag();
            return make_response(true);
        }
        else if (method == "set_drag_zone") {
            bool active = req["params"].value("active", false);
            extern void set_drag_zone_active(bool active);
            set_drag_zone_active(active);
            return make_response(true);
        }
        else if (method == "settings_get") {
            auto settings = settings_service_->get_settings();
            return make_response(settings);
        }
        else if (method == "settings_set") {
            json new_settings = req["params"].value("settings", json::object());
            bool success = settings_service_->set_settings(new_settings);
            return make_response(success);
        }
        else if (method == "lsp_initialize") {
            std::string language = req["params"].value("language", "");
            bool success = lsp_service_->initialize_server(language, [send_to_client_cb, language](const std::string& lsp_msg) {
                try {
                    json notif;
                    notif["jsonrpc"] = "2.0";
                    notif["method"] = "lsp_notification";
                    notif["params"] = {
                        {"language", language},
                        {"message", json::parse(lsp_msg)}
                    };
                    send_to_client_cb(notif.dump());
                } catch (...) {}
            });
            return make_response(success);
        }
        else if (method == "lsp_send") {
            std::string language = req["params"].value("language", "");
            std::string lsp_msg = req["params"]["message"].dump();
            bool success = lsp_service_->send_message(language, lsp_msg);
            return make_response(success);
        }
        else if (method == "lsp_shutdown") {
            std::string language = req["params"].value("language", "");
            lsp_service_->shutdown_server(language);
            return make_response(true);
        }
        else if (method == "git_stage") {
            std::string repo_path = req["params"].value("repo_path", "");
            std::string file_path = req["params"].value("file_path", "");
            bool success = git_service_->stage_file(repo_path, file_path);
            return make_response(success);
        }
        else if (method == "git_commit") {
            std::string repo_path = req["params"].value("repo_path", "");
            std::string message = req["params"].value("message", "");
            std::string author_name = req["params"].value("author_name", "Samuel Yevi");
            std::string author_email = req["params"].value("author_email", "samuel@leumas-labs.com");
            bool success = git_service_->commit(repo_path, message, author_name, author_email);
            return make_response(success);
        }
        else if (method == "extension_list") {
            auto exts = ext_service_->scan_extensions();
            json arr = json::array();
            for (const auto& ext : exts) {
                arr.push_back({
                    {"id", ext.id},
                    {"name", ext.name},
                    {"version", ext.version},
                    {"path", ext.path},
                    {"contributions", ext.contributions}
                });
            }
            return make_response(arr);
        }
        else if (method == "extension_install") {
            std::string vsix_path = req["params"].value("vsix_path", "");
            bool success = ext_service_->install_extension(vsix_path);
            return make_response(success);
        }

        return make_response("Method not found: " + method, true);

    } catch (const std::exception& e) {
        json resp;
        resp["jsonrpc"] = "2.0";
        resp["error"] = {{"code", -32700}, {"message", std::string("Parse error: ") + e.what()}};
        resp["id"] = nullptr;
        return resp.dump(-1, ' ', false, json::error_handler_t::replace);
    }
}
