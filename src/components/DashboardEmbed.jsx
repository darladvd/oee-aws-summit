import { useEffect, useRef } from 'react';
import { createEmbeddingContext } from 'amazon-quicksight-embedding-sdk';

function DashboardEmbed({ embedUrl, onEmbedError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!embedUrl || !containerRef.current) {
      return undefined;
    }

    let mounted = true;

    async function loadDashboard() {
      try {
        const embeddingContext = await createEmbeddingContext();
        if (!mounted || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = '';

        await embeddingContext.embedDashboard({
          url: embedUrl,
          container: containerRef.current,
          width: '100%',
          height: '100%',
          withIframePlaceholder: true,
          onChange: (event) => {
            console.log('QuickSight dashboard frame event:', event);
          },
        });
      } catch (error) {
        console.error('QuickSight embed failed:', error);
        if (mounted && onEmbedError) {
          onEmbedError('QuickSight embed failed to initialize.');
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [embedUrl]);

  return <div ref={containerRef} className="dashboard-embed-root" />;
}

export default DashboardEmbed;
