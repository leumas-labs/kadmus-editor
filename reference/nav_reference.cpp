#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <cairo/cairo.h>
#include <cairo/cairo-xlib.h>
#include <iostream>
#include <vector>
#include <string>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Colors in hex representation parsed to Cairo RGB
struct Color {
    double r, g, b;
    Color() : r(0.0), g(0.0), b(0.0) {}
    Color(double r, double g, double b) : r(r), g(g), b(b) {}
    Color(int hex) {
        r = ((hex >> 16) & 0xFF) / 255.0;
        g = ((hex >> 8) & 0xFF) / 255.0;
        b = (hex & 0xFF) / 255.0;
    }
};

// Layout coordinates
const int TOOLBAR_WIDTH = 55;
const int FILE_TREE_WIDTH = 220;
const int AGENT_PANEL_WIDTH = 280;
const int TERMINAL_HEIGHT = 180;
const int TAB_BAR_HEIGHT = 35;

// State management
int current_tab = 0; // 0: main.cpp, 1: parser.kd, 2: schema.json
int active_tool = 4; // 0: Explorer, 1: Search, 2: Git, 3: Extensions, 4: Agents (chat)
bool show_agent_panel = true;

struct Button {
    int x, y, w, h;
    int id;
};

std::vector<Button> toolbar_buttons;
std::vector<Button> editor_tabs;

void draw_rounded_rect(cairo_t* cr, double x, double y, double w, double h, double radius) {
    cairo_new_sub_path(cr);
    cairo_arc(cr, x + w - radius, y + radius, radius, -90 * M_PI / 180.0, 0 * M_PI / 180.0);
    cairo_arc(cr, x + w - radius, y + h - radius, radius, 0 * M_PI / 180.0, 90 * M_PI / 180.0);
    cairo_arc(cr, x + radius, y + h - radius, radius, 90 * M_PI / 180.0, 180 * M_PI / 180.0);
    cairo_arc(cr, x + radius, y + radius, radius, 180 * M_PI / 180.0, 270 * M_PI / 180.0);
    cairo_close_path(cr);
}

void draw_icon(cairo_t* cr, int type, int x, int y, bool active) {
    cairo_save(cr);
    if (active) {
        cairo_set_source_rgb(cr, 0.388, 0.4, 0.945); // Indigo
    } else {
        cairo_set_source_rgb(cr, 0.5, 0.5, 0.55); // Gray-blue
    }
    cairo_set_line_width(cr, 2.0);

    if (type == 0) { // Document/Files
        cairo_rectangle(cr, x - 8, y - 10, 16, 20);
        cairo_stroke(cr);
        cairo_move_to(cr, x - 4, y - 4); cairo_line_to(cr, x + 4, y - 4);
        cairo_move_to(cr, x - 4, y + 1); cairo_line_to(cr, x + 4, y + 1);
        cairo_stroke(cr);
    } else if (type == 1) { // Search
        cairo_arc(cr, x - 2, y - 2, 6, 0, 2 * M_PI);
        cairo_stroke(cr);
        cairo_move_to(cr, x + 2, y + 2);
        cairo_line_to(cr, x + 8, y + 8);
        cairo_stroke(cr);
    } else if (type == 2) { // Git (branch)
        cairo_arc(cr, x, y - 6, 3, 0, 2 * M_PI);
        cairo_arc(cr, x - 5, y + 5, 3, 0, 2 * M_PI);
        cairo_arc(cr, x + 5, y + 5, 3, 0, 2 * M_PI);
        cairo_fill(cr);
        cairo_move_to(cr, x, y - 3);
        cairo_line_to(cr, x - 5, y + 2);
        cairo_move_to(cr, x, y - 3);
        cairo_line_to(cr, x + 5, y + 2);
        cairo_stroke(cr);
    } else if (type == 3) { // Extensions (blocks)
        cairo_rectangle(cr, x - 8, y - 8, 7, 7);
        cairo_rectangle(cr, x + 1, y - 8, 7, 7);
        cairo_rectangle(cr, x - 8, y + 1, 7, 7);
        cairo_rectangle(cr, x + 1, y + 1, 7, 7);
        cairo_stroke(cr);
    } else if (type == 4) { // AI Agent (Sparkle)
        cairo_move_to(cr, x, y - 10);
        cairo_curve_to(cr, x, y - 2, x, y - 2, x + 8, y);
        cairo_curve_to(cr, x, y + 2, x, y + 2, x, y + 10);
        cairo_curve_to(cr, x, y + 2, x, y + 2, x - 8, y);
        cairo_curve_to(cr, x, y - 2, x, y - 2, x, y - 10);
        cairo_fill(cr);
    }
    cairo_restore(cr);
}

void draw_ui(cairo_t* cr, int width, int height) {
    // Clear background
    Color bg_dark(0x121214);
    cairo_set_source_rgb(cr, bg_dark.r, bg_dark.g, bg_dark.b);
    cairo_paint(cr);

    // -------------------------------------------------------------
    // 1. LEFT TOOLBAR (Activity Bar)
    // -------------------------------------------------------------
    Color bar_color(0x18181b);
    cairo_set_source_rgb(cr, bar_color.r, bar_color.g, bar_color.b);
    cairo_rectangle(cr, 0, 0, TOOLBAR_WIDTH, height);
    cairo_fill(cr);

    // Border line
    cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
    cairo_set_line_width(cr, 1.0);
    cairo_move_to(cr, TOOLBAR_WIDTH, 0);
    cairo_line_to(cr, TOOLBAR_WIDTH, height);
    cairo_stroke(cr);

    // Toolbar buttons
    toolbar_buttons.clear();
    for (int i = 0; i < 5; ++i) {
        int btn_y = 20 + i * 60;
        toolbar_buttons.push_back({0, btn_y, TOOLBAR_WIDTH, 50, i});

        // Draw indicator active bar
        if (i == active_tool) {
            cairo_set_source_rgb(cr, 0.388, 0.4, 0.945); // Active Indigo indicator
            cairo_rectangle(cr, 0, btn_y + 10, 3, 30);
            cairo_fill(cr);
        }

        draw_icon(cr, i, TOOLBAR_WIDTH / 2, btn_y + 25, i == active_tool);
    }

    // -------------------------------------------------------------
    // 2. FILE EXPLORER SIDEBAR
    // -------------------------------------------------------------
    int sidebar_w = FILE_TREE_WIDTH;
    Color tree_bg(0x141416);
    cairo_set_source_rgb(cr, tree_bg.r, tree_bg.g, tree_bg.b); // File tree background
    cairo_rectangle(cr, TOOLBAR_WIDTH, 0, sidebar_w, height);
    cairo_fill(cr);

    // Border line
    cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
    cairo_move_to(cr, TOOLBAR_WIDTH + sidebar_w, 0);
    cairo_line_to(cr, TOOLBAR_WIDTH + sidebar_w, height);
    cairo_stroke(cr);

    // Explorer Header
    cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD);
    cairo_set_font_size(cr, 11.0);
    cairo_set_source_rgb(cr, 0.6, 0.6, 0.65);
    cairo_move_to(cr, TOOLBAR_WIDTH + 15, 25);
    cairo_show_text(cr, "EXPLORER: KDLANG-PROJECT");

    // File Tree Mock
    cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cr, 13.0);

    // Directory 1
    cairo_set_source_rgb(cr, 0.75, 0.75, 0.8);
    cairo_move_to(cr, TOOLBAR_WIDTH + 15, 55);
    cairo_show_text(cr, "v .notes");
    cairo_set_source_rgb(cr, 0.5, 0.5, 0.6);
    cairo_move_to(cr, TOOLBAR_WIDTH + 30, 75);
    cairo_show_text(cr, "TOPOLOGY.md");

    // Directory 2
    cairo_set_source_rgb(cr, 0.75, 0.75, 0.8);
    cairo_move_to(cr, TOOLBAR_WIDTH + 15, 105);
    cairo_show_text(cr, "v src");

    // Files in src
    std::vector<std::pair<std::string, bool>> files = {
        {"main.cpp", current_tab == 0},
        {"parser.kd", current_tab == 1},
        {"schema.json", current_tab == 2}
    };

    for (size_t i = 0; i < files.size(); ++i) {
        if (files[i].second) {
            cairo_set_source_rgb(cr, 0.18, 0.18, 0.25); // Selected tree background
            cairo_rectangle(cr, TOOLBAR_WIDTH + 5, 120 + i * 25, sidebar_w - 10, 22);
            cairo_fill(cr);
            cairo_set_source_rgb(cr, 0.85, 0.85, 1.0); // Active text
        } else {
            cairo_set_source_rgb(cr, 0.6, 0.6, 0.65); // Inactive text
        }
        cairo_move_to(cr, TOOLBAR_WIDTH + 30, 136 + i * 25);
        cairo_show_text(cr, files[i].first.c_str());
    }

    // -------------------------------------------------------------
    // 3. MAIN EDITOR AREA (Middle Panel)
    // -------------------------------------------------------------
    int editor_x = TOOLBAR_WIDTH + sidebar_w;
    int editor_w = width - editor_x - (show_agent_panel ? AGENT_PANEL_WIDTH : 0);
    int editor_h = height - TERMINAL_HEIGHT;

    // Editor Background
    Color ed_bg(0x121214);
    cairo_set_source_rgb(cr, ed_bg.r, ed_bg.g, ed_bg.b);
    cairo_rectangle(cr, editor_x, 0, editor_w, editor_h);
    cairo_fill(cr);

    // Editor Tabs Bar
    Color tabs_bg(0x161618);
    cairo_set_source_rgb(cr, tabs_bg.r, tabs_bg.g, tabs_bg.b); // Darker tabs background
    cairo_rectangle(cr, editor_x, 0, editor_w, TAB_BAR_HEIGHT);
    cairo_fill(cr);

    // Editor Tabs Border
    cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
    cairo_move_to(cr, editor_x, TAB_BAR_HEIGHT);
    cairo_line_to(cr, editor_x + editor_w, TAB_BAR_HEIGHT);
    cairo_stroke(cr);

    // Render Editor Tabs
    editor_tabs.clear();
    int tab_x = editor_x;
    for (int i = 0; i < 3; ++i) {
        std::string tab_name;
        if (i == 0) tab_name = "main.cpp";
        else if (i == 1) tab_name = "parser.kd";
        else if (i == 2) tab_name = "schema.json";

        int tab_w = 120;
        editor_tabs.push_back({tab_x, 0, tab_w, TAB_BAR_HEIGHT, i});

        if (i == current_tab) {
            Color active_tab_bg(0x121214);
            cairo_set_source_rgb(cr, active_tab_bg.r, active_tab_bg.g, active_tab_bg.b); // Active tab matches editor background
            cairo_rectangle(cr, tab_x, 0, tab_w, TAB_BAR_HEIGHT);
            cairo_fill(cr);

            // Active Tab Top Line indicator
            cairo_set_source_rgb(cr, 0.388, 0.4, 0.945); // Indigo line
            cairo_rectangle(cr, tab_x, 0, tab_w, 2);
            cairo_fill(cr);

            cairo_set_source_rgb(cr, 0.9, 0.9, 0.95);
        } else {
            cairo_set_source_rgb(cr, 0.5, 0.5, 0.55);
        }

        cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
        cairo_set_font_size(cr, 12.0);
        cairo_move_to(cr, tab_x + 15, 22);
        cairo_show_text(cr, tab_name.c_str());

        // Draw tab divider
        cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
        cairo_move_to(cr, tab_x + tab_w, 0);
        cairo_line_to(cr, tab_x + tab_w, TAB_BAR_HEIGHT);
        cairo_stroke(cr);

        tab_x += tab_w;
    }

    // Editor Content (Syntax Highlighted Text)
    cairo_select_font_face(cr, "Monospace", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cr, 13.0);

    // Mock code lines based on selected tab
    std::vector<std::vector<std::pair<std::string, Color>>> code_lines;

    code_lines.clear();
    if (current_tab == 0) { // main.cpp
        code_lines.push_back({{"#include ", Color(0xf43f5e)}, {"<iostream>", Color(0x4ade80)}});
        code_lines.push_back({{"#include ", Color(0xf43f5e)}, {"<cairo/cairo.h>", Color(0x4ade80)}});
        code_lines.push_back({{"", Color()}});
        code_lines.push_back({{"int ", Color(0x38bdf8)}, {"main", Color(0xfb923c)}, {"() {", Color(0xcccccc)}});
        code_lines.push_back({{"    std::cout << ", Color(0xcccccc)}, {"\"Bootstrapping Kadmus...\" ", Color(0x4ade80)}, {"<< std::endl;", Color(0xcccccc)}});
        code_lines.push_back({{"    cairo_surface_t* ", Color(0x38bdf8)}, {"surface = ", Color(0xcccccc)}, {"cairo_image_surface_create", Color(0xfb923c)}, {"(...);", Color(0xcccccc)}});
        code_lines.push_back({{"    cairo_t* ", Color(0x38bdf8)}, {"cr = ", Color(0xcccccc)}, {"cairo_create", Color(0xfb923c)}, {"(surface);", Color(0xcccccc)}});
        code_lines.push_back({{"", Color()}});
        code_lines.push_back({{"    // Draw custom native compiler frame", Color(0x6b7280)}});
        code_lines.push_back({{"    ", Color(0xcccccc)}, {"draw_editor_canvas", Color(0xfb923c)}, {"(cr, 1024, 768);", Color(0xcccccc)}});
        code_lines.push_back({{"    return ", Color(0xf43f5e)}, {"0", Color(0xfb923c)}, {";", Color(0xcccccc)}});
        code_lines.push_back({{"}", Color(0xcccccc)}});
    } else if (current_tab == 1) { // parser.kd
        code_lines.push_back({{"editor ", Color(0xf43f5e)}, {"KadmusIDE ", Color(0x4ade80)}, {"{", Color(0xcccccc)}});
        code_lines.push_back({{"    identity ", Color(0x38bdf8)}, {"{", Color(0xcccccc)}});
        code_lines.push_back({{"        name: ", Color(0xcccccc)}, {"\"Kadmus Custom\"", Color(0x4ade80)}, {",", Color(0xcccccc)}});
        code_lines.push_back({{"        version: ", Color(0xcccccc)}, {"\"1.0.0\"", Color(0x4ade80)}});
        code_lines.push_back({{"    }", Color(0xcccccc)}});
        code_lines.push_back({{"", Color()}});
        code_lines.push_back({{"    layout ", Color(0x38bdf8)}, {"{", Color(0xcccccc)}});
        code_lines.push_back({{"        renderer: ", Color(0xcccccc)}, {"\"cairo-cpu\"", Color(0x4ade80)}, {",", Color(0xcccccc)}});
        code_lines.push_back({{"        activeTheme: ", Color(0xcccccc)}, {"\"indigo-dark\"", Color(0x4ade80)}});
        code_lines.push_back({{"    }", Color(0xcccccc)}});
        code_lines.push_back({{"}", Color(0xcccccc)}});
    } else { // schema.json
        code_lines.push_back({{"{", Color(0xcccccc)}});
        code_lines.push_back({{"  \"$schema\": ", Color(0xfb923c)}, {"\"http://json-schema.org/draft-07/schema#\"", Color(0x4ade80)}, {",", Color(0xcccccc)}});
        code_lines.push_back({{"  \"title\": ", Color(0xfb923c)}, {"\"KadmusEditorSchema\"", Color(0x4ade80)}, {",", Color(0xcccccc)}});
        code_lines.push_back({{"  \"type\": ", Color(0xfb923c)}, {"\"object\"", Color(0x4ade80)}, {",", Color(0xcccccc)}});
        code_lines.push_back({{"  \"properties\": ", Color(0xfb923c)}, {"{", Color(0xcccccc)}});
        code_lines.push_back({{"    \"identity\": ", Color(0xfb923c)}, {"{ \"type\": \"object\" }", Color(0x4ade80)}});
        code_lines.push_back({{"  }", Color(0xcccccc)}});
        code_lines.push_back({{"}", Color(0xcccccc)}});
    }

    // Render code
    for (size_t r = 0; r < code_lines.size(); ++r) {
        int line_y = 65 + r * 22;

        // Draw line numbers
        cairo_set_source_rgb(cr, 0.35, 0.35, 0.4);
        cairo_move_to(cr, editor_x + 15, line_y);
        std::string num = std::to_string(r + 1);
        cairo_show_text(cr, num.c_str());

        // Draw code token-by-token
        int token_x = editor_x + 50;
        for (const auto& token : code_lines[r]) {
            Color tok_color(token.second);
            cairo_set_source_rgb(cr, tok_color.r, tok_color.g, tok_color.b);
            cairo_move_to(cr, token_x, line_y);
            cairo_show_text(cr, token.first.c_str());

            // Measure token width to advance X
            cairo_text_extents_t extents;
            cairo_text_extents(cr, token.first.c_str(), &extents);
            token_x += extents.x_advance;
        }
    }

    // -------------------------------------------------------------
    // 4. BOTTOM PANEL (Terminal)
    // -------------------------------------------------------------
    int term_y = height - TERMINAL_HEIGHT;
    int term_w = width - TOOLBAR_WIDTH - (show_agent_panel ? AGENT_PANEL_WIDTH : 0);

    // Terminal Background
    Color term_bg(0x0a0a0c);
    cairo_set_source_rgb(cr, term_bg.r, term_bg.g, term_bg.b); // Darker pure black background
    cairo_rectangle(cr, TOOLBAR_WIDTH, term_y, term_w, TERMINAL_HEIGHT);
    cairo_fill(cr);

    // Panel border
    cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
    cairo_move_to(cr, TOOLBAR_WIDTH, term_y);
    cairo_line_to(cr, TOOLBAR_WIDTH + term_w, term_y);
    cairo_stroke(cr);

    // Terminal Header
    cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD);
    cairo_set_font_size(cr, 11.0);
    cairo_set_source_rgb(cr, 0.6, 0.6, 0.65);
    cairo_move_to(cr, TOOLBAR_WIDTH + 20, term_y + 20);
    cairo_show_text(cr, "TERMINAL: local-zsh");

    // Terminal Text
    cairo_select_font_face(cr, "Monospace", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cr, 12.0);
    
    // Command 1
    cairo_set_source_rgb(cr, 0.4, 0.8, 0.4); // green user/host
    cairo_move_to(cr, TOOLBAR_WIDTH + 20, term_y + 50);
    cairo_show_text(cr, "samuel-yevi@leumas-labs:~/Dev/Researches/previews/nav$ ");
    cairo_set_source_rgb(cr, 0.9, 0.9, 0.9);
    cairo_text_extents_t extents;
    cairo_text_extents(cr, "samuel-yevi@leumas-labs:~/Dev/Researches/previews/nav$ ", &extents);
    cairo_move_to(cr, TOOLBAR_WIDTH + 20 + extents.x_advance, term_y + 50);
    cairo_show_text(cr, "make run");

    // Output
    cairo_set_source_rgb(cr, 0.6, 0.6, 0.65);
    cairo_move_to(cr, TOOLBAR_WIDTH + 20, term_y + 72);
    cairo_show_text(cr, "g++ nav.cpp -o nav -lX11 -lcairo");
    cairo_move_to(cr, TOOLBAR_WIDTH + 20, term_y + 90);
    cairo_show_text(cr, "./nav");

    // Prompt
    cairo_set_source_rgb(cr, 0.4, 0.8, 0.4);
    cairo_move_to(cr, TOOLBAR_WIDTH + 20, term_y + 115);
    cairo_show_text(cr, "samuel-yevi@leumas-labs:~/Dev/Researches/previews/nav$ ");

    // Blinking cursor mock
    cairo_text_extents(cr, "samuel-yevi@leumas-labs:~/Dev/Researches/previews/nav$ ", &extents);
    cairo_set_source_rgb(cr, 0.388, 0.4, 0.945); // Indigo cursor
    cairo_rectangle(cr, TOOLBAR_WIDTH + 20 + extents.x_advance + 2, term_y + 103, 8, 15);
    cairo_fill(cr);

    // -------------------------------------------------------------
    // 5. RIGHT SIDEBAR (AI Agent Chat Panel)
    // -------------------------------------------------------------
    if (show_agent_panel) {
        int panel_x = width - AGENT_PANEL_WIDTH;

        // Panel Background
        Color agent_bg(0x141416);
        cairo_set_source_rgb(cr, agent_bg.r, agent_bg.g, agent_bg.b); // Same dark sidebar color
        cairo_rectangle(cr, panel_x, 0, AGENT_PANEL_WIDTH, height);
        cairo_fill(cr);

        // Border line Left
        cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
        cairo_move_to(cr, panel_x, 0);
        cairo_line_to(cr, panel_x, height);
        cairo_stroke(cr);

        // Agent Title Header
        cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD);
        cairo_set_font_size(cr, 12.0);
        cairo_set_source_rgb(cr, 0.9, 0.9, 0.95);
        cairo_move_to(cr, panel_x + 20, 25);
        cairo_show_text(cr, "KADMUS ASSISTANT");

        // Subtle underline
        cairo_set_source_rgb(cr, 0.15, 0.15, 0.18);
        cairo_move_to(cr, panel_x + 15, 38);
        cairo_line_to(cr, width - 15, 38);
        cairo_stroke(cr);

        // Chat Conversation bubbles
        cairo_select_font_face(cr, "Outfit", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
        cairo_set_font_size(cr, 12.5);

        // Message 1 (User)
        int bubble1_y = 55;
        draw_rounded_rect(cr, panel_x + 40, bubble1_y, AGENT_PANEL_WIDTH - 60, 48, 8);
        cairo_set_source_rgb(cr, 0.18, 0.18, 0.24); // Blueish bubble
        cairo_fill(cr);
        cairo_set_source_rgb(cr, 0.9, 0.9, 0.95);
        cairo_move_to(cr, panel_x + 52, bubble1_y + 20);
        cairo_show_text(cr, "How do we draw the IDE?");
        cairo_move_to(cr, panel_x + 52, bubble1_y + 36);
        cairo_show_text(cr, "Can we run CPU-only cairo?");

        // Message 2 (Agent AI)
        int bubble2_y = 120;
        draw_rounded_rect(cr, panel_x + 20, bubble2_y, AGENT_PANEL_WIDTH - 50, 72, 8);
        cairo_set_source_rgb(cr, 0.1, 0.1, 0.12); // Darker bubble
        cairo_fill(cr);
        // Thin glowing border
        cairo_set_source_rgb(cr, 0.2, 0.2, 0.25);
        draw_rounded_rect(cr, panel_x + 20, bubble2_y, AGENT_PANEL_WIDTH - 50, 72, 8);
        cairo_stroke(cr);

        cairo_set_source_rgb(cr, 0.45, 0.8, 0.95); // AI Header Blue
        cairo_move_to(cr, panel_x + 32, bubble2_y + 20);
        cairo_show_text(cr, "Kadmus AI:");

        cairo_set_source_rgb(cr, 0.8, 0.8, 0.85);
        cairo_move_to(cr, panel_x + 32, bubble2_y + 40);
        cairo_show_text(cr, "Yes! Cairo draws vector shapes");
        cairo_move_to(cr, panel_x + 32, bubble2_y + 56);
        cairo_show_text(cr, "entirely on CPU. Very fast!");

        // Chat Input Box (Bottom of chat)
        int input_y = height - 60;
        draw_rounded_rect(cr, panel_x + 20, input_y, AGENT_PANEL_WIDTH - 40, 40, 8);
        cairo_set_source_rgb(cr, 0.08, 0.08, 0.1);
        cairo_fill(cr);
        cairo_set_source_rgb(cr, 0.18, 0.18, 0.22);
        draw_rounded_rect(cr, panel_x + 20, input_y, AGENT_PANEL_WIDTH - 40, 40, 8);
        cairo_stroke(cr);

        cairo_set_source_rgb(cr, 0.5, 0.5, 0.55);
        cairo_move_to(cr, panel_x + 35, input_y + 24);
        cairo_show_text(cr, "Ask Agent anything...");
    }
}

int main() {
    Display* dpy = XOpenDisplay(NULL);
    if (!dpy) {
        std::cerr << "Error: Unable to open X display" << std::endl;
        return 1;
    }

    int screen = DefaultScreen(dpy);
    Window root_win = RootWindow(dpy, screen);

    // Initial window size
    int width = 1100;
    int height = 700;

    // Create window with dark slate background pixel value
    unsigned long bg_pixel = 0x121214;
    Window win = XCreateSimpleWindow(dpy, root_win, 100, 100, width, height, 1, 0, bg_pixel);

    // Set Window title
    XStoreName(dpy, win, "Kadmus Native IDE Preview - C++/Cairo CPU Engine");

    // Enable WM protocols to close cleanly
    Atom wm_delete_window = XInternAtom(dpy, "WM_DELETE_WINDOW", False);
    XSetWMProtocols(dpy, win, &wm_delete_window, 1);

    // Ask X11 to notify us of Expose (draw), Configure (resize), and ButtonPress (mouse clicks)
    XSelectInput(dpy, win, ExposureMask | StructureNotifyMask | ButtonPressMask);

    XMapWindow(dpy, win);

    // Setup Cairo
    Visual* visual = DefaultVisual(dpy, screen);
    cairo_surface_t* surface = cairo_xlib_surface_create(dpy, win, visual, width, height);
    cairo_t* cr = cairo_create(surface);

    bool running = true;
    XEvent event;

    while (running) {
        XNextEvent(dpy, &event);

        if (event.type == Expose && event.xexpose.count == 0) {
            draw_ui(cr, width, height);
            cairo_surface_flush(surface);
        }
        else if (event.type == ConfigureNotify) {
            // Window resize event
            width = event.xconfigure.width;
            height = event.xconfigure.height;
            cairo_xlib_surface_set_size(surface, width, height);
            draw_ui(cr, width, height);
            cairo_surface_flush(surface);
        }
        else if (event.type == ButtonPress) {
            int click_x = event.xbutton.x;
            int click_y = event.xbutton.y;

            // Check clicks on editor tabs
            for (const auto& tab : editor_tabs) {
                if (click_x >= tab.x && click_x <= tab.x + tab.w &&
                    click_y >= tab.y && click_y <= tab.y + tab.h) {
                    current_tab = tab.id;
                    // Trigger a redraw
                    XClearArea(dpy, win, 0, 0, 0, 0, True);
                    break;
                }
            }

            // Check clicks on sidebar icons
            for (const auto& btn : toolbar_buttons) {
                if (click_x >= btn.x && click_x <= btn.x + btn.w &&
                    click_y >= btn.y && click_y <= btn.y + btn.h) {
                    active_tool = btn.id;
                    if (btn.id == 4) {
                        show_agent_panel = !show_agent_panel; // Toggle AI Agent panel
                    }
                    XClearArea(dpy, win, 0, 0, 0, 0, True);
                    break;
                }
            }
        }
        else if (event.type == ClientMessage) {
            if ((Atom)event.xclient.data.l[0] == wm_delete_window) {
                running = false;
            }
        }
    }

    cairo_destroy(cr);
    cairo_surface_destroy(surface);
    XDestroyWindow(dpy, win);
    XCloseDisplay(dpy);

    return 0;
}
