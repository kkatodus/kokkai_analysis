import React, { useLayoutEffect } from 'react';
import {
  RiGovernmentLine,
  RiInformationLine,
  RiGovernmentFill,
  RiUserSearchFill,
  RiFilePaper2Line,
} from 'react-icons/ri';
import { FaDonate } from 'react-icons/fa';
import useModalState from 'modals/useModalState';
import { useWebView } from 'contexts/WebViewContext';
import { BsClipboardDataFill } from 'react-icons/bs';
import BaseMenuLayout from '../../layouts/BaseMenuLayout';


/**
 *
 * @return {JSX.Element}
 */
function LandingPage() {
  const { addModal } = useModalState();
  const { isWebView } = useWebView();
  useLayoutEffect(() => {
    if (!isWebView) {
      addModal('payment');
    }
  }, [isWebView]);
  const LandingMenuIcon = [
	{
		link: '/page_info',
		icon: <RiInformationLine className="menu-icon" />,
		title: 'ページ情報',
	},
    
    {
      link: '/repr_analysis',
      icon: <RiUserSearchFill className="menu-icon" />,
      title: '議員分析',
    },
	{
	  link: '/party_manifesto',
	  icon: <RiFilePaper2Line className="menu-icon" />,
	  title: '政策分析',
	},
    {
      link: '/stats',
      icon: <BsClipboardDataFill className="menu-icon" />,
      title: '統計',
    },
   
	{
		link: '/sangiin_menu',
		icon: <RiGovernmentLine className="menu-icon" />,
		title: '参議院',
	},
	{
		link: '/shugiin_menu',
		icon: <RiGovernmentFill className="menu-icon" />,
		title: '衆議院',
	},
  ];
  
  // Only add donation button if not in webview
  if (!isWebView) {
    LandingMenuIcon.push({
      link: null,
      icon: <FaDonate className="menu-icon" />,
      title: '募金する',
      onClick: () => addModal('payment'),
    });
  }
  return <BaseMenuLayout MenuTitle="KOKKAI DOC" Links={LandingMenuIcon} />;
}

export default LandingPage;
