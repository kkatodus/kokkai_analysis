import React from 'react';
import { Link } from 'react-router-dom';
import Div100vh from 'react-div-100vh';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import ModalManager from 'modals';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';

export default function BaseMenuLayout(props) {
  const { MenuTitle, Links, backTo } = props;
  const { type } = useDisplaySize();
  const isMobile = type === 'mobile';
  const linksComponents = Links.map((icon) => {
    if (icon.link === null) {
      return (
        <button key={icon.link} onClick={icon.onClick} type="button">
          <div className="flex flex-col items-center justify-center m-6">
            <div className={`border-solid border-4 rounded-full p-2 border-black grow-on-hover-medium ${isMobile ? 'text-3xl' : 'text-6xl'}`}>
              {icon.icon}
            </div>
            <h3 className="text-xl mt-3">{icon.title}</h3>
          </div>
        </button>
      );
    }	
    
    return (
      <Link key={icon.link} to={icon.link}>
        <div className="flex flex-col items-center justify-center m-6">
          <div className={`border-solid border-4 rounded-full p-2 border-black grow-on-hover-medium ${isMobile ? 'text-3xl' : 'text-6xl'}`}>
            {icon.icon}
          </div>
          <h3 className="text-xl mt-3">{icon.title}</h3>
        </div>
      </Link>
    );
  });
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

        <div className="h-[90%] w-screen flex flex-col items-center ">
          <h1 className="text-5xl flex-shrink-0 pt-4">{MenuTitle}</h1>
          <div className="flex-1 overflow-y-auto w-full">
            <div className="flex items-center justify-center flex-wrap min-h-full p-4">
              {linksComponents}
            </div>
          </div>
        </div>
        
          <footer className="absolute bottom-0 w-full p-4 text-center">
            <div className="flex justify-center items-center space-x-4 text-sm text-gray-600">
              <Link to="/privacy-policy" className="hover:text-gray-800 underline">
                プライバシーポリシー
              </Link>
              <span>|</span>
              <Link to="/terms-and-conditions" className="hover:text-gray-800 underline">
                利用規約
              </Link>
            </div>
          </footer>
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
      onClick: Proptypes.func,
    })
  ).isRequired,
  backTo: Proptypes.string,
};
