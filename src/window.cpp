#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#include <iostream>
#include <string>

// Destroy callback to exit GTK event loop
static void on_destroy(GtkWidget* widget, gpointer data) {
    gtk_main_quit();
}

int main(int argc, char* argv[]) {
    // Parse target URL from arguments
    std::string target_url = "http://localhost:5173"; // default to Vite dev server
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "--url" || arg == "-u") && i + 1 < argc) {
            target_url = argv[i + 1];
            break;
        }
    }

    std::cout << "[window] Starting Kadmus WebView window loading: " << target_url << std::endl;

    // Initialize GTK
    gtk_init(&argc, &argv);

    // Create main top-level window
    GtkWidget* main_window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title(GTK_WINDOW(main_window), "Kadmus Editor");
    gtk_window_set_default_size(GTK_WINDOW(main_window), 1280, 800);

    // Create WebKit WebView
    GtkWidget* web_view = webkit_web_view_new();

    // Enable developer options (Right click -> Inspect Element)
    WebKitSettings* settings = webkit_web_view_get_settings(WEBKIT_WEB_VIEW(web_view));
    webkit_settings_set_enable_developer_extras(settings, TRUE);
    webkit_settings_set_enable_webgl(settings, TRUE);

    // Load target URL
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), target_url.c_str());

    // Pack Webview container into window
    gtk_container_add(GTK_CONTAINER(main_window), web_view);

    // Bind window destroy event
    g_signal_connect(main_window, "destroy", G_CALLBACK(on_destroy), NULL);

    // Show window and all its children
    gtk_widget_show_all(main_window);

    // Start GTK Event Loop
    gtk_main();

    std::cout << "[window] Kadmus WebView window closed." << std::endl;
    return 0;
}
