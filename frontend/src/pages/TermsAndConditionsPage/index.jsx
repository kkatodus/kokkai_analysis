import React, { useState, useEffect } from 'react';
import { policyEndpoint } from 'resource/resources';

function TermsAndConditionsPage() {
  const [termsContent, setTermsContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  console.log('TermsAndConditionsPage', termsContent);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await fetch(policyEndpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch terms');
        }
        const data = await response.json();
        setTermsContent(data.terms_and_conditions);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTerms();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500">エラー: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-auto p-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div 
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: termsContent }} 
        />
      </div>
    </div>
  );
}

export default TermsAndConditionsPage;