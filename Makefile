UNAME_S := $(shell uname -s)

CXX = g++
CXXFLAGS = -O3 -std=c++20 -I./include

ifeq ($(UNAME_S),Linux)
    LIBS = -pthread -lutil -lgit2
    GTK_FLAGS = $(shell pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.1)
    WINDOW_TARGET = ce-window
else
    LIBS = -pthread -lgit2
    WINDOW_TARGET = 
endif

TARGET = ce-backend
TEST_TARGET = ce-test

SRC = src/main.cpp \
      src/FileSystemService.cpp \
      src/TerminalManager.cpp \
      src/AgentService.cpp \
      src/JSONRPCRouter.cpp \
      src/WebSocketServer.cpp \
      src/GitService.cpp \
      src/ExtensionService.cpp

TEST_SRC = src/test.cpp \
           src/FileSystemService.cpp \
           src/TerminalManager.cpp \
           src/AgentService.cpp \
           src/JSONRPCRouter.cpp \
           src/WebSocketServer.cpp \
           src/GitService.cpp \
           src/ExtensionService.cpp

all: $(TARGET) $(WINDOW_TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET) $(LIBS)

$(WINDOW_TARGET): src/window.cpp
	$(CXX) $(CXXFLAGS) src/window.cpp -o $(WINDOW_TARGET) $(GTK_FLAGS)

test: $(TEST_TARGET)
	./$(TEST_TARGET)

$(TEST_TARGET): $(TEST_SRC)
	$(CXX) $(CXXFLAGS) $(TEST_SRC) -o $(TEST_TARGET) $(LIBS)

clean:
	rm -f $(TARGET) $(TEST_TARGET) $(WINDOW_TARGET)

run: all
	./$(TARGET)
