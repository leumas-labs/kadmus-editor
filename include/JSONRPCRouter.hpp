#pragma once

#include <string>
#include <functional>
#include <memory>
#include "FileSystemService.hpp"
#include "TerminalManager.hpp"
#include "AgentService.hpp"
#include "GitService.hpp"

// Route and parse JSON-RPC messages from the WebSocket client
class JSONRPCRouter {
public:
    JSONRPCRouter(
        std::shared_ptr<FileSystemService> fs_service,
        std::shared_ptr<TerminalManager> term_manager,
        std::shared_ptr<AgentService> agent_service,
        std::shared_ptr<GitService> git_service
    );
    ~JSONRPCRouter();

    // Handle incoming client message. Responses can be returned sync or pushed async via the callback.
    std::string handle_request(const std::string& raw_json, std::function<void(const std::string&)> send_to_client_cb);

private:
    std::shared_ptr<FileSystemService> fs_service_;
    std::shared_ptr<TerminalManager> term_manager_;
    std::shared_ptr<AgentService> agent_service_;
    std::shared_ptr<GitService> git_service_;
};
