#include <iostream>
#include <memory>
#include <csignal>
#include <atomic>
#include <thread>
#include <chrono>
#include <cstdlib>
#include <ctime>
#include <filesystem>

#include "../include/FileSystemService.hpp"
#include "../include/TerminalManager.hpp"
#include "../include/AgentService.hpp"
#include "../include/GitService.hpp"
#include "../include/ExtensionService.hpp"
#include "../include/SettingsService.hpp"
#include "../include/LanguageServerProtocol.hpp"
#include "../include/JSONRPCRouter.hpp"
#include "../include/WebSocketServer.hpp"

// Conditional inclusion of GTK and WebKitGTK for Linux WebView Window Wrapper
#ifdef __linux__
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#endif

namespace fs = std::filesystem;

std::atomic<bool> keep_running(true);

void signal_handler(int signal) {
    if (signal == SIGINT || signal == SIGTERM) {
        std::cout << "\n[info] Shutdown signal received. Stopping server..." << std::endl;
        keep_running = false;
#ifdef __linux__
        // If GTK loop is running, quit it
        if (gtk_main_level() > 0) {
            gtk_main_quit();
        }
#endif
    }
}

// Retrieves user's home directory across platforms
std::string get_home_dir() {
#ifdef _WIN32
    const char* home = std::getenv("USERPROFILE");
#else
    const char* home = std::getenv("HOME");
#endif
    return home ? home : ".";
}

// Generates a secure random connection token if none is provided
std::string generate_connection_token() {
    const char alphabet[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";
    std::string token = "";
    std::srand(std::time(nullptr));
    for (int i = 0; i < 24; ++i) {
        token += alphabet[std::rand() % (sizeof(alphabet) - 1)];
    }
    return token;
}

struct ServerArgs {
    int port = 9888;
    std::string workspace = "";
    std::string server_data_dir = "";
    std::string extensions_dir = "";
    std::string connection_token = "";
    bool accept_any_connection = false;
    bool server_only = false;
    bool dev = false;
    bool help = false;
};

ServerArgs parse_arguments(int argc, char* argv[]) {
    ServerArgs args;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            args.port = std::stoi(argv[++i]);
        } else if (arg == "--workspace" && i + 1 < argc) {
            args.workspace = argv[++i];
        } else if (arg == "--server-data-dir" && i + 1 < argc) {
            args.server_data_dir = argv[++i];
        } else if (arg == "--extensions-dir" && i + 1 < argc) {
            args.extensions_dir = argv[++i];
        } else if (arg == "--connection-token" && i + 1 < argc) {
            args.connection_token = argv[++i];
        } else if (arg == "--without-connection-token") {
            args.accept_any_connection = true;
        } else if (arg == "--server-only" || arg == "-s") {
            args.server_only = true;
        } else if (arg == "--dev") {
            args.dev = true;
        } else if (arg == "--help" || arg == "-h") {
            args.help = true;
        }
    }
    return args;
}

void print_help() {
    std::cout << "Kadmus Editor - Unified App & Server" << std::endl;
    std::cout << "Usage: kadmus [options]" << std::endl << std::endl;
    std::cout << "Options:" << std::endl;
    std::cout << "  --port <port>                 Port to listen on (default: 9888)" << std::endl;
    std::cout << "  --workspace <path>            Path to workspace root (default: current directory)" << std::endl;
    std::cout << "  --server-data-dir <path>      Path to storing server configs & user logs (default: ~/.interface-studio)" << std::endl;
    std::cout << "  --extensions-dir <path>       Path to extensions folder" << std::endl;
    std::cout << "  --connection-token <token>    Set security token for incoming WebSocket connections" << std::endl;
    std::cout << "  --without-connection-token    Disable token validation (WARNING: unsafe!)" << std::endl;
    std::cout << "  --dev                         Run in development mode (prioritize Vite Dev Server over static files)" << std::endl;
    std::cout << "  -s, --server-only             Run backend server headless without opening UI window" << std::endl;
    std::cout << "  -h, --help                    Show help options" << std::endl;
}

#ifdef __linux__
GtkWidget* g_main_window = nullptr;
std::atomic<bool> g_drag_zone_active(false);

void set_drag_zone_active(bool active) {
    g_drag_zone_active.store(active);
}

extern "C" {
    static gboolean do_minimize(gpointer data) {
        if (g_main_window) gtk_window_iconify(GTK_WINDOW(g_main_window));
        return FALSE;
    }
    static gboolean do_maximize(gpointer data) {
        if (g_main_window) {
            if (gtk_window_is_maximized(GTK_WINDOW(g_main_window))) {
                gtk_window_unmaximize(GTK_WINDOW(g_main_window));
            } else {
                gtk_window_maximize(GTK_WINDOW(g_main_window));
            }
        }
        return FALSE;
    }
    static gboolean do_close(gpointer data) {
        if (g_main_window) gtk_window_close(GTK_WINDOW(g_main_window));
        return FALSE;
    }
    static gboolean do_drag(gpointer data) {
        if (g_main_window) {
            GdkDisplay* display = gdk_display_get_default();
            GdkSeat* seat = gdk_display_get_default_seat(display);
            GdkDevice* pointer = gdk_seat_get_pointer(seat);
            int root_x = 0, root_y = 0;
            gdk_device_get_position(pointer, nullptr, &root_x, &root_y);
            
            gtk_window_begin_move_drag(
                GTK_WINDOW(g_main_window),
                1,
                root_x,
                root_y,
                gdk_event_get_time(nullptr)
            );
        }
        return FALSE;
    }

    static gboolean on_webview_button_press(GtkWidget* widget, GdkEventButton* event, gpointer user_data) {
        if (g_drag_zone_active.load()) {
            if (event->type == GDK_BUTTON_PRESS && event->button == 1) {
                gtk_window_begin_move_drag(
                    GTK_WINDOW(g_main_window),
                    event->button,
                    event->x_root,
                    event->y_root,
                    event->time
                );
                return TRUE; // Consume event so WebKit doesn't get it
            } else if (event->type == GDK_2BUTTON_PRESS && event->button == 1) {
                if (gtk_window_is_maximized(GTK_WINDOW(g_main_window))) {
                    gtk_window_unmaximize(GTK_WINDOW(g_main_window));
                } else {
                    gtk_window_maximize(GTK_WINDOW(g_main_window));
                }
                return TRUE; // Consume event
            }
        }
        return FALSE; // Propagate event normally
    }
}

void trigger_window_minimize() {
    g_idle_add(do_minimize, nullptr);
}
void trigger_window_maximize() {
    g_idle_add(do_maximize, nullptr);
}
void trigger_window_close() {
    g_idle_add(do_close, nullptr);
}
void trigger_window_drag() {
    g_idle_add(do_drag, nullptr);
}

// Destroy callback to exit GTK event loop
static void on_window_destroy(GtkWidget* widget, gpointer data) {
    std::cout << "[window] Window closed by user. Initiating clean shutdown..." << std::endl;
    keep_running = false;
    gtk_main_quit();
}

void run_webview_window(int port, const std::string& token, bool dev_mode) {
    int argc = 0;
    char** argv = nullptr;
    
    // Initialize GTK
    gtk_init(&argc, &argv);

    // Create main window
    GtkWidget* main_window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    g_main_window = main_window;
    gtk_window_set_title(GTK_WINDOW(main_window), "Kadmus Editor");
    gtk_window_set_default_size(GTK_WINDOW(main_window), 1280, 800);

    // Disable native title bar decorations for soft_design
    gtk_window_set_decorated(GTK_WINDOW(main_window), FALSE);

    // Force GTK into CSD mode with an invisible custom titlebar.
    // This strips native Mutter/Pop Shell titlebar decorations completely.
    GtkWidget* empty_titlebar = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    gtk_widget_show(empty_titlebar);
    gtk_window_set_titlebar(GTK_WINDOW(main_window), empty_titlebar);

    // Enable RGBA visual for transparency support
    GdkScreen* screen = gtk_widget_get_screen(main_window);
    GdkVisual* visual = gdk_screen_get_rgba_visual(screen);
    if (visual && gdk_screen_is_composited(screen)) {
        gtk_widget_set_visual(main_window, visual);
    }

    // Create WebKit WebView
    GtkWidget* web_view = webkit_web_view_new();

    // Intercept mouse clicks for synchronous drag/maximize operations
    g_signal_connect(web_view, "button-press-event", G_CALLBACK(on_webview_button_press), NULL);

    // Set WebView background transparent
    GdkRGBA transparent_color = {0.0, 0.0, 0.0, 0.0};
    webkit_web_view_set_background_color(WEBKIT_WEB_VIEW(web_view), &transparent_color);

    // Enable inspector & local file security bypassing
    WebKitSettings* settings = webkit_web_view_get_settings(WEBKIT_WEB_VIEW(web_view));
    webkit_settings_set_enable_developer_extras(settings, TRUE);
    webkit_settings_set_enable_webgl(settings, TRUE);
    webkit_settings_set_allow_file_access_from_file_urls(settings, TRUE);
    webkit_settings_set_allow_universal_access_from_file_urls(settings, TRUE);

    // Determine target URL: prioritize Vite Dev Server in dev_mode, or load local dist/index.html otherwise
    std::string url;
    fs::path dist_path = fs::current_path() / "frontend" / "dist" / "index.html";
    if (dev_mode) {
        url = "http://localhost:5173/?t=" + token;
    } else if (fs::exists(dist_path)) {
        url = "file://" + fs::canonical(dist_path).string() + "?t=" + token;
    } else {
        url = "http://localhost:5173/?t=" + token;
    }

    std::cout << "[window] Loading WebView target URL: " << url << std::endl;
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), url.c_str());

    // Pack Webview container into window
    gtk_container_add(GTK_CONTAINER(main_window), web_view);

    // Bind window destroy event
    g_signal_connect(main_window, "destroy", G_CALLBACK(on_window_destroy), NULL);

    // Show window and all its children
    gtk_widget_show_all(main_window);

    // Start GTK Event Loop
    gtk_main();
}
#else
void trigger_window_minimize() {}
void trigger_window_maximize() {}
void trigger_window_close() {}
void trigger_window_drag() {}
#endif

int main(int argc, char* argv[]) {
    // Parse arguments
    ServerArgs args = parse_arguments(argc, argv);
    if (args.help) {
        print_help();
        return 0;
    }

    // Register signal handlers for clean exit
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    // Resolve directories
    std::string home = get_home_dir();
    std::string server_data_dir = args.server_data_dir.empty() ? (home + "/.interface-studio") : args.server_data_dir;
    std::string user_data_path = server_data_dir + "/data";
    std::string extensions_dir = args.extensions_dir.empty() ? (server_data_dir + "/extensions") : args.extensions_dir;
    std::string workspace_path = args.workspace.empty() ? fs::current_path().string() : fs::absolute(args.workspace).string();

    // Create folder structures
    try {
        fs::create_directories(server_data_dir);
        fs::create_directories(user_data_path);
        fs::create_directories(extensions_dir);
    } catch (const std::exception& e) {
        std::cerr << "[error] Failed to initialize data directories: " << e.what() << std::endl;
        return 1;
    }

    // Generate security token
    std::string token = "";
    if (!args.accept_any_connection) {
        token = args.connection_token.empty() ? generate_connection_token() : args.connection_token;
    }

    // -------------------------------------------------------------
    // Boot sequence logs
    // -------------------------------------------------------------
    std::cout << "* " << std::endl;
    std::cout << "* Kadmus Editor - Native Application" << std::endl;
    std::cout << "* " << std::endl;
    std::cout << "* Visual Studio Code Server Compatibility Layer" << std::endl;
    std::cout << "* Release: 1.0.0 (Native C++ Engine)" << std::endl;
    std::cout << "* Commit:  ceb78c92a95c47da95cae1f0e25a39fb" << std::endl;
    std::cout << "* " << std::endl;
    std::cout << "[info] Server data directory: " << server_data_dir << std::endl;
    std::cout << "[info] Extensions directory:  " << extensions_dir << std::endl;
    std::cout << "[info] Workspace root:        " << workspace_path << std::endl;
    std::cout << "[info] Extension host agent started." << std::endl;

    if (!token.empty()) {
        std::cout << "[info] " << std::endl;
        std::cout << "[info] Log in token: " << token << std::endl;
        std::cout << "[info] Use this token to authenticate: ws://localhost:" << args.port << "/?t=" << token << std::endl;
        std::cout << "[info] " << std::endl;
    } else {
        std::cout << "[warning] Running without connection token security. Server is open." << std::endl;
    }

    // Initialize Services
    auto fs_service = std::make_shared<FileSystemService>(workspace_path);
    auto term_manager = std::make_shared<TerminalManager>();
    auto agent_service = std::make_shared<AgentService>();
    auto git_service = std::make_shared<GitService>();
    auto ext_service = std::make_shared<ExtensionService>(extensions_dir);
    auto settings_service = std::make_shared<SettingsService>(server_data_dir);
    auto lsp_service = std::make_shared<LspService>(settings_service);

    // Instantiate JSONRPCRouter
    auto router = std::make_shared<JSONRPCRouter>(
        fs_service, term_manager, agent_service, git_service, ext_service, settings_service, lsp_service
    );

    // Instantiate and start WebSocket Server
    auto server = std::make_unique<WebSocketServer>(args.port, router, token);
    if (!server->start()) {
        std::cerr << "[error] Failed to start WebSocket server on port " << args.port << std::endl;
        return 1;
    }

    // Determine execution mode (headless server-only vs. desktop client window)
    if (args.server_only) {
        std::cout << "[info] Running in server-only headless mode." << std::endl;
        while (keep_running) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    } else {
#ifdef __linux__
        std::cout << "[info] Launching native webview window..." << std::endl;
        run_webview_window(args.port, token, args.dev);
#else
        std::cout << "[warning] WebView desktop window is only supported on Linux/GTK in this build." << std::endl;
        std::cout << "[info] Falling back to server-only mode." << std::endl;
        while (keep_running) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
#endif
    }

    // Clean shutdown
    std::cout << "[info] Cleaning up active sessions..." << std::endl;
    server->stop();
    std::cout << "[info] Kadmus Editor shutdown completed." << std::endl;

    return 0;
}
