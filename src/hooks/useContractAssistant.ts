import { useState } from "react";
import { toast } from "sonner";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useContractAssistant = (contractId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Añadir mensaje del usuario
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Llamar a la edge function
      const response = await fetch(
        `https://wnkifmuhkhdjbswraini.supabase.co/functions/v1/contract-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractId,
            message: content,
            sessionId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener respuesta');
      }

      // Procesar streaming (SSE)
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo iniciar el streaming');

      const decoder = new TextDecoder();
      let assistantContent = '';
      
      // Añadir mensaje del asistente vacío
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Procesar líneas completas
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Guardar línea incompleta
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              
              if (delta) {
                assistantContent += delta;
                
                // Actualizar UI en tiempo real
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantContent
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignorar errores de parsing de JSON parcial
            }
          }
        }
      }

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      toast.error('Error al comunicar con el asistente');
      
      // Remover mensaje del asistente vacío si hay error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sendMessage,
    isLoading,
    sessionId
  };
};
