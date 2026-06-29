#pragma once

#include <string>
#include <functional>

// Orchestrates the AI Agent sessions and prompt execution
class AgentService {
public:
    AgentService();
    ~AgentService();

    // Process a chat query from the user and respond asynchronously
    void send_message(const std::string& session_id, const std::string& message, std::function<void(const std::string&)> on_reply);
};
