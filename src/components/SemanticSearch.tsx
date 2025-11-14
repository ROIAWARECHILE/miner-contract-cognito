import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  content: string;
  document_id: number;
  contract_code: string;
}

const SemanticSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('semantic-search', {
        body: { query },
      });

      if (error) throw error;
      if (!data) throw new Error('No results found.');

      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during the search.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Búsqueda Semántica de Documentos</h2>
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Qué información necesitas del contrato?"
            className="flex-grow p-2 border rounded"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <div className="mt-6">
        {results.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Resultados:</h3>
            <ul className="space-y-4">
              {results.map((result, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded border">
                  <p className="text-gray-800">{result.content}</p>
                  <div className="text-sm text-gray-500 mt-2">
                    <span>Contrato: {result.contract_code}</span> |
                    <span> Documento ID: {result.document_id}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default SemanticSearch;
