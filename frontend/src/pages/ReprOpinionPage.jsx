import React from 'react';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../layouts/BasePageLayout';

const param2title = {
  defence: '防衛',
  aging: '少子化',
  lgbt: 'LGBT',
  immigration: '移民政策',
  energy: 'エネルギー',
};

function ReprOpinionPage() {
  const { topic } = useParams();
  return (
    <BasePageLayout pageTitle={param2title[topic]} backTo="/repr_analysis" />
  );
}

export default ReprOpinionPage;
