import React from 'react';
import { PiShield } from 'react-icons/pi';
import { BiChild, BiSolidShip } from 'react-icons/bi';
import { BsRainbow } from 'react-icons/bs';
import { SlEnergy } from 'react-icons/sl';
import BaseMenuLayout from '../layouts/BaseMenuLayout';

const analysisTopics = [
  { title: '防衛', icon: <PiShield className="menu-icon" />, link: 'defence' },
  { title: '少子化', icon: <BiChild className="menu-icon" />, link: 'aging' },
  { title: 'LGBT', icon: <BsRainbow className="menu-icon" />, link: 'lgbt' },
  {
    title: '移民政策',
    icon: <BiSolidShip className="menu-icon" />,
    link: 'immigration',
  },
  {
    title: 'エネルギー',
    icon: <SlEnergy className="menu-icon" />,
    link: 'energy',
  },
];

function ReprOpinionMenuPage() {
  return (
    <BaseMenuLayout MenuTitle="発言分析" Links={analysisTopics} backTo="/" />
  );
}

export default ReprOpinionMenuPage;
