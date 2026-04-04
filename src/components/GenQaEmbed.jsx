import { useEffect, useRef } from 'react';
import { createEmbeddingContext } from 'amazon-quicksight-embedding-sdk';

function GenQaEmbed({ embedUrl }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!embedUrl || !containerRef.current) {
      return undefined;
    }

    let mounted = true;

    async function loadQ() {
      try {
        const embeddingContext = await createEmbeddingContext();
        if (!mounted || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = '';

        await embeddingContext.embedGenerativeQnA({
          url: embedUrl,
          container: containerRef.current,
          width: '100%',
          height: '100%',
        });
      } catch (error) {
        console.error('QuickSight Generative Q&A embed failed:', error);
      }
    }

    loadQ();

    return () => {
      mounted = false;
    };
  }, [embedUrl]);

  return <div ref={containerRef} className="genqa-embed-root" />;
}

export default GenQaEmbed;
