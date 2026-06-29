#include <iostream>
#include <memory>
#include <csignal>
#include <atomic>
#include <thread>
#include <chrono>

#include "../include/FileSystemService.hpp"
#include "../include/TerminalManager.hpp"
#include "../include/AgentService.hpp"
#include "../include/JSONRPCRouter.hpp"
#include "../include/WebSocketServer.hpp"

std::atomic<bool> keep_running(true);

void signal_handler(int signal) {
    if (signal == SIGINT || signal == SIGTERM) {
        std::cout << "\nShutdown signal received. Stopping CEBackend..." << std::endl;
        keep_running = false;
    }
}

int main() {
    // Register signal handlers for clean exit
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::cout << "=========================================" << std::endl;
    std::cout << "  Interface Studio - CEBackend Prototype" << std::endl;
    std::cout << "=========================================" << std::endl;

    // 1. Instantiate the Core Services
    auto fs_service = std::make_shared<FileSystemService>(".");
    auto term_manager = std::make_shared<TerminalManager>();
    auto agent_service = std::make_shared<AgentService>();

    // 2. Instantiate the JSON-RPC Router
    auto router = std::make_shared<JSONRPCRouter>(fs_service, term_manager, agent_service);

    // 3. Instantiate and Start the WebSocket Server (Port 9888)
    int port = 9888;
    auto server = std::make_unique<WebSocketServer>(port, router);
    if (!server->start()) {
        std::cerr << "CRITICAL: Could not start the WebSocket server." << std::endl;
        return 1;
    }

    std::cout << "Backend is active. Press Ctrl+C to terminate..." << std::endl;

    // 4. Main Thread Idle Loop (runs until signal is caught)
    while (keep_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    // 5. Cleanup and Graceful Shutdown
    std::cout << "Cleaning up active connections and processes..." << std::endl;
    server->stop();
    std::cout << "CEBackend stopped successfully." << std::endl;

    return 0;
}
