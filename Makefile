UNAME_S := $(shell uname -s)

CXX = g++
CXXFLAGS = -O3 -std=c++20 -I./include

ifeq ($(UNAME_S),Linux)
    LIBS = -pthread -lutil -lgit2
else
    LIBS = -pthread -lgit2
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

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET) $(LIBS)

test: $(TEST_TARGET)
	./$(TEST_TARGET)

$(TEST_TARGET): $(TEST_SRC)
	$(CXX) $(CXXFLAGS) $(TEST_SRC) -o $(TEST_TARGET) $(LIBS)

clean:
	rm -f $(TARGET) $(TEST_TARGET)

run: all
	./$(TARGET)
