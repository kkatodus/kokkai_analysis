import React from 'react';
import { Link } from 'react-router-dom';
import Div100vh from 'react-div-100vh';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import ModalManager from 'modals';
import { colors } from 'resource/styling';

export default function BaseMenuLayout(props) {
  const { MenuTitle, Links, backTo } = props;
  const linksComponents = Links.map((icon) => (
    <Link key={icon.link} to={icon.link}>
      <div className="flex flex-col items-center justify-center m-6">
        <div className="text-6xl border-solid border-4 rounded-full p-2 border-black grow-on-hover-medium">
          {icon.icon}
        </div>
        <h3 className="text-xl mt-3">{icon.title}</h3>
      </div>
    </Link>
  ));
  return (
    <Div100vh>
      <div
        className={`h-[100%] w-[100%] relative flex justify-center items-center ${colors.secondary} `}
      >
        <ModalManager />
        {backTo && (
          <Link className="back-icon absolute top-0 left-0 p-2" to={backTo}>
            <MdOutlineArrowBack className="menu-icon" />
          </Link>
        )}

        <div className="h-3/5 w-screen flex flex-col items-center justify-center">
          <h1 className="text-5xl">{MenuTitle}</h1>
          <div className="flex item-center justify-center flex-wrap">
            {linksComponents}
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

BaseMenuLayout.defaultProps = { backTo: null };

BaseMenuLayout.propTypes = {
  MenuTitle: Proptypes.string.isRequired,
  Links: Proptypes.arrayOf(
    Proptypes.shape({
      link: Proptypes.string,
      icon: Proptypes.element,
      title: Proptypes.string,
    })
  ).isRequired,
  backTo: Proptypes.string,
};
