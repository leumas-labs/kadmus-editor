#include <iostream>
#include <memory>
#include <cassert>
#include <nlohmann/json.hpp>

#include "../include/FileSystemService.hpp"
#include "../include/TerminalManager.hpp"
#include "../include/AgentService.hpp"
#include "../include/GitService.hpp"
#include "../include/JSONRPCRouter.hpp"

using json = nlohmann::json;

// Helper callback to capture async notifications (not used in synchronous responses but required by signature)
void mock_send_cb(const std::string& notif) {
    std::cout << "[async notification received]: " << notif << std::endl;
}

void run_test_case_1(std::shared_ptr<JSONRPCRouter> router) {
    std::cout << "\n--------------------------------------------------" << std::endl;
    std::cout << "TEST CASE 1: Directory Traversal Security Protection" << std::endl;
    std::cout << "--------------------------------------------------" << std::endl;

    // Send a dangerous request seeking to read a file outside the workspace root
    std::string request = R"({
        "jsonrpc": "2.0",
        "method": "fs_read",
        "params": {
            "path": "../../../../etc/passwd"
        },
        "id": 101
    })";

    std::cout << "Sending Request: " << request << std::endl;
    std::string raw_response = router->handle_request(request, mock_send_cb);
    std::cout << "Received Response: " << raw_response << std::endl;

    // Parse and assert response properties
    auto resp = json::parse(raw_response);
    
    assert(resp["jsonrpc"] == "2.0");
    assert(resp["id"] == 101);
    
    // The response should have returned an empty content or error because the directory traversal was blocked!
    // Since fs_read returns empty string "" on error, the result field should contain ""
    assert(resp.contains("result"));
    assert(resp["result"] == "");
    
    std::cout << ">> TEST CASE 1 PASSED: Traversal attempt blocked safely." << std::endl;
}

void run_test_case_2(std::shared_ptr<JSONRPCRouter> router) {
    std::cout << "\n--------------------------------------------------" << std::endl;
    std::cout << "TEST CASE 2: Git Status API Query (libgit2)" << std::endl;
    std::cout << "--------------------------------------------------" << std::endl;

    // Send a standard git status request for the current workspace
    std::string request = R"({
        "jsonrpc": "2.0",
        "method": "git_status",
        "params": {
            "repo_path": "."
        },
        "id": 102
    })";

    std::cout << "Sending Request: " << request << std::endl;
    std::string raw_response = router->handle_request(request, mock_send_cb);
    std::cout << "Received Response: " << raw_response << std::endl;

    // Parse and assert response properties
    auto resp = json::parse(raw_response);
    
    assert(resp["jsonrpc"] == "2.0");
    assert(resp["id"] == 102);
    assert(resp.contains("result"));
    assert(resp["result"].is_array()); // Git status must return a list of modified files

    std::cout << ">> TEST CASE 2 PASSED: Git status retrieved successfully. File count: " 
              << resp["result"].size() << std::endl;
}

int main() {
    std::cout << "=== RUNNING AUTOMATED API SOLIDITY TESTS ===" << std::endl;

    // Initialize Services on current directory "."
    auto fs_service = std::make_shared<FileSystemService>(".");
    auto term_manager = std::make_shared<TerminalManager>();
    auto agent_service = std::make_shared<AgentService>();
    auto git_service = std::make_shared<GitService>();

    // Instantiate Router
    auto router = std::make_shared<JSONRPCRouter>(fs_service, term_manager, agent_service, git_service);

    try {
        // Run tests
        run_test_case_1(router);
        run_test_case_2(router);
        
        std::cout << "\n==============================================" << std::endl;
        std::cout << " ALL TESTS COMPLETED SUCCESSFULLY! CODE IS SOLID." << std::endl;
        std::cout << "==============================================" << std::endl;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "\n[assertion failed] Test runner error: " << e.what() << std::endl;
        return 1;
    }
}
