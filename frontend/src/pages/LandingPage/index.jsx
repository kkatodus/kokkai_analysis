import React from 'react';
import {
  RiGovernmentLine,
  RiInformationLine,
  RiGovernmentFill,
  RiUserSearchFill,
} from 'react-icons/ri';
import { BsClipboardDataFill } from 'react-icons/bs';
import BaseMenuLayout from '../../layouts/BaseMenuLayout';

const LandingMenuIcon = [
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
  {
    link: '/repr_analysis',
    icon: <RiUserSearchFill className="menu-icon" />,
    title: '議員分析',
  },
  {
    link: '/stats',
    icon: <BsClipboardDataFill className="menu-icon" />,
    title: '統計',
  },
  {
    link: '/page_info',
    icon: <RiInformationLine className="menu-icon" />,
    title: '',
  },
];
/**
 *
 * @return {JSX.Element}
 */
function LandingPage() {
  return <BaseMenuLayout MenuTitle="KOKKAI DOC" Links={LandingMenuIcon} />;
}

export default LandingPage;
