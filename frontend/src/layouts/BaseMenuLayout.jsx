import React from 'react';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';

export default function BaseMenuLayout(props) {
  const { MenuTitle, Links, backTo } = props;
  const linksComponents = Links.map((icon) => (
    <Link key={icon.link} to={icon.link}>
      <div className="flex flex-col items-center justify-center">
        <div className="menu-icon-container">{icon.icon}</div>
        <h3>{icon.title}</h3>
      </div>
    </Link>
  ));
  return (
    <div
      className={`h-screen w-screen relative flex justify-center items-center ${colors.secondary}`}
    >
      <Link className="back-icon absolute top-0 left-0 p-2" to={backTo}>
        <MdOutlineArrowBack className="menu-icon" />
      </Link>
      <div className="h-3/5 w-3/5 flex flex-col items-center justify-center">
        <h1 className="text-5xl">{MenuTitle}</h1>
        <div className="flex item-center justify-center">{linksComponents}</div>
      </div>
    </div>
  );
}

BaseMenuLayout.propTypes = {
  MenuTitle: Proptypes.string.isRequired,
  Links: Proptypes.arrayOf(
    Proptypes.shape({
      link: Proptypes.string,
      icon: Proptypes.element,
      title: Proptypes.string,
    })
  ).isRequired,
  backTo: Proptypes.string.isRequired,
};
