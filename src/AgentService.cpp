#include "../include/AgentService.hpp"
#include <thread>
#include <chrono>
#include <algorithm>
#include <iostream>

AgentService::AgentService() {}

AgentService::~AgentService() {}

void AgentService::send_message(
    const std::string& session_id,
    const std::string& message,
    std::function<void(const std::string&)> on_reply
) {
    // Spawn a background thread to simulate asynchronous AI processing (LLM latency)
    std::thread([message, on_reply]() {
        // Simulate a delay of 1.5 seconds for AI response generation
        std::this_thread::sleep_for(std::chrono::milliseconds(1500));

        // Convert query to lower case for simple matching
        std::string query = message;
        std::transform(query.begin(), query.end(), query.begin(), ::tolower);

        std::string reply;
        if (query.find("cairo") != std::string::npos || query.find("draw") != std::string::npos) {
            reply = "Le moteur Cairo est un choix excellent pour IS. Il dessine en vectoriel directement dans un tampon CPU de façon synchrone ou asynchrone.";
        } else if (query.find("terminal") != std::string::npos || query.find("pty") != std::string::npos) {
            reply = "Pour le terminal, nous utilisons forkpty sur Unix/macOS et l'API native ConPTY sur Windows. Tout est encapsulé dans notre classe TerminalManager.";
        } else if (query.find("windows") != std::string::npos) {
            reply = "Sur Windows, nous chargerons l'API ConPTY de Microsoft (disponible depuis Windows 10) qui remplace le vieux conhost.exe.";
        } else {
            reply = "Bonjour ! Je suis l'assistant IA natif d'Interface Studio (IS). Notre backend C++ répond en temps réel sur le CPU !";
        }

        // Call the asynchronous callback with our reply
        on_reply(reply);
    }).detach(); // Detach thread so it runs independently in the background
}
