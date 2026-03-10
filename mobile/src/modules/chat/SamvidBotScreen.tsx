import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppInput } from "../../components/common/ui";
import { askSamvid } from "../../services/samvidService";
import { toErrorMessage } from "../../utils/errorMessage";

type BotMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const SamvidBotScreen = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: uid(),
      role: "bot",
      text: "Hello, I am Samvid bot. How can I help you.",
    },
  ]);

  const scrollRef = useRef<ScrollView | null>(null);
  const recognitionRef = useRef<any>(null);

  const canSend = useMemo(() => input.trim().length > 1 && !loading, [input, loading]);

  useEffect(() => {
    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsMicSupported(false);
      recognitionRef.current = null;
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const parts = [];
        for (let i = event?.resultIndex || 0; i < (event?.results?.length || 0); i += 1) {
          if (!event.results[i]?.isFinal) continue;
          const transcript = String(event.results[i]?.[0]?.transcript || "").trim();
          if (transcript) parts.push(transcript);
        }

        const finalText = parts.join(" ").replace(/\s+/g, " ").trim();
        if (!finalText) return;
        setInput((prev) => `${String(prev || "").trim()} ${finalText}`.trim());
      };

      recognitionRef.current = recognition;
      setIsMicSupported(true);
    } catch {
      setIsMicSupported(false);
      recognitionRef.current = null;
    }

    return () => {
      if (!recognitionRef.current) return;
      try {
        recognitionRef.current.stop();
      } catch {}
    };
  }, []);

  const sendQuery = async (queryText?: string) => {
    const query = String(queryText || input || "").trim();
    if (query.length < 2 || loading) return;

    const userMessage: BotMessage = {
      id: uid(),
      role: "user",
      text: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await askSamvid(query);
      const answer = String(response.answer || "No response").trim() || "No response";

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          text: answer,
        },
      ]);
    } catch (e) {
      const message = toErrorMessage(e, "Samvid bot failed to respond");
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          text: `Error: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      setError("Voice input browser me supported nahi hai");
      return;
    }

    try {
      setError("");
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch {
      setError("Voice input start nahi ho paaya. Dobara try karein.");
      setIsListening(false);
    }
  };

  return (
    <Screen title="Samvid Bot" subtitle="Ask Inventory, Leads, Performance" error={error}>
      <AppCard style={styles.card as object}>
        <ScrollView
          ref={(instance) => {
            scrollRef.current = instance;
          }}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.role === "user" ? styles.userRow : styles.botRow]}>
              <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.bubbleText, message.role === "user" ? styles.userBubbleText : styles.botBubbleText]}>
                  {message.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <AppInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask Samvid..."
                style={styles.chatInput as object}
              />
            </View>
            <Pressable
              style={[styles.voiceBtn, (!isMicSupported || loading) && styles.voiceBtnDisabled]}
              onPress={toggleVoice}
              disabled={!isMicSupported || loading}
            >
              <Ionicons name={isListening ? "mic" : "mic-outline"} size={18} color="#0f172a" />
            </Pressable>
          </View>

          <AppButton title={loading ? "Thinking..." : "Send"} onPress={() => sendQuery()} disabled={!canSend} />
        </View>
      </AppCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 0,
    marginBottom: 12,
  },
  chatArea: {
    flex: 1,
    minHeight: 180,
  },
  chatContent: {
    flexGrow: 1,
    paddingBottom: 8,
    gap: 8,
  },
  messageRow: {
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  botRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "90%",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  userBubble: {
    backgroundColor: "#0f172a",
  },
  botBubble: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bubbleText: {
    fontSize: 12,
    lineHeight: 18,
  },
  userBubbleText: {
    color: "#f8fafc",
  },
  botBubbleText: {
    color: "#0f172a",
  },
  composer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  inputWrap: {
    flex: 1,
  },
  chatInput: {
    marginBottom: 0,
  },
  voiceBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  voiceBtnDisabled: {
    opacity: 0.45,
  },
});
