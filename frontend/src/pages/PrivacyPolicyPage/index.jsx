import React, { useState, useEffect } from 'react';
import { policyEndpoint } from 'resource/resources';

function PrivacyPolicyPage() {
  const [policyContent, setPolicyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await fetch(policyEndpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch policy');
        }
        const data = await response.json();
        setPolicyContent(data.privacy_policy);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
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
          dangerouslySetInnerHTML={{ __html: policyContent }} 
        />
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;