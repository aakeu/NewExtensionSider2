import React from 'react'
import MenuBar from '../components/menuBar/MenuBar'
import Footer from '../components/footer/Footer'
import { useSelector } from 'react-redux'
import { RootState } from '../state'
import './sidebar.css'

export default function SiderContainer({children}:{children: React.ReactNode}) {
  const {isDarkMode} = useSelector((state:RootState)=>state.theme)

  return (
    <div className={`sider-container ${isDarkMode ? "darkmode" : "lightmode"}`}>
        <div className='sider-col-1'>
            <div className='child'>
                {children}
            </div>
            <MenuBar />
        </div>
        <Footer />
    </div>
  )
}
