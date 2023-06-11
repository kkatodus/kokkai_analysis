import React from 'react'
import { Link } from 'react-router-dom'
import { MdOutlineArrowBack } from 'react-icons/md'
import Proptypes from 'prop-types'
import { colors } from '../resource/styling'

export default function BasePageLayout (props) {
  return (
  <div className='flex flex-col h-screen'>
    <div className={'h-1/6 flex items-center ' + colors.primary}>
      <Link className="back-icon" to={props.backTo}>
        <MdOutlineArrowBack/>
      </Link>
      <h1 className='text-4xl px-3 '>{props.pageTitle}</h1>
    </div>
    <div className={'h-5/6 overflow-y-scroll bg-slate-300' + colors.secondary}>
      {props.MainContent}
    </div>
  </div>
  )
}

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string,
  backTo: Proptypes.string,
  MainContent: Proptypes.element
}
