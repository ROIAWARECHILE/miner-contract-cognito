import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContractAssistantProps {
  contractId: string;
  contractCode: string;
}

export const ContractAssistant = ({ contractId, contractCode }: ContractAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hola, soy tu asistente experto en contratos mineros chilenos. 👋\n\nEstoy aquí para ayudarte con el contrato **${contractCode}**. Puedo:\n\n• Analizar el estado actual del contrato\n• Identificar irregularidades y riesgos\n• Asesorarte sobre procedimientos y legislación chilena\n• Responder preguntas sobre presupuestos, tareas y EDPs\n\n¿En qué puedo ayudarte hoy?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    // Añadir mensaje del usuario
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
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

  const handleProactiveAnalysis = () => {
    handleSendMessage(
      'Analiza el estado actual del contrato e identifica todos los riesgos, irregularidades y problemas que requieran mi atención. ' +
      'Proporciona un reporte completo con recomendaciones priorizadas.'
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[600px] gap-4">
      {/* Header con botón de análisis proactivo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Asistente de Contrato</h3>
          <Badge variant="secondary" className="ml-2">
            <Sparkles className="h-3 w-3 mr-1" />
            IA Experto
          </Badge>
        </div>
        
        <Button
          onClick={handleProactiveAnalysis}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Analizar Contrato
        </Button>
      </div>

      {/* Área de mensajes */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.content}
                </div>
                
                {message.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Input de mensaje */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta sobre el contrato... (Enter para enviar, Shift+Enter para nueva línea)"
          disabled={isLoading}
          className="min-h-[60px] max-h-[120px] resize-none"
          rows={2}
        />
        <Button
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-[60px] w-[60px]"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* Sugerencias rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSendMessage('¿Qué tareas tienen problemas de presupuesto?')}
          disabled={isLoading}
        >
          Tareas problemáticas
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSendMessage('¿Necesito generar una orden de cambio?')}
          disabled={isLoading}
        >
          Orden de cambio
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSendMessage('¿Cuál es el estado de los EDPs?')}
          disabled={isLoading}
        >
          Estado EDPs
        </Button>
      </div>
    </div>
  );
};
