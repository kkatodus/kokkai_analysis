
import React from 'react'
import { RiGovernmentLine, RiInformationLine, RiGovernmentFill } from 'react-icons/ri'
import '../styles/general.css'
import '../styles/pages/landing_page.css'
import BaseMenuLayout from '../layouts/BaseMenuLayout'

const LandingMenuIcon = [
  {
    link: '/sangiin_menu',
    icon: <RiGovernmentLine className="menu-icon"/>,
    title: '参議院'
  },
  {
    link: '/shugiin_menu',
    icon: <RiGovernmentFill className="menu-icon"/>,
    title: '衆議院'
  },
  {
    link: '/page_info',
    icon: <RiInformationLine className="menu-icon"/>,
    title: ''
  }

]
/**
 *
 * @return {JSX.Element}
 */
function LandingPage () {
  return (
    <BaseMenuLayout backTo='' MenuTitle='KOKKAI DOC' Links={LandingMenuIcon}/>
  )
}

export default LandingPage
