import React, { useState, useEffect, useRef } from 'react';
import { User, CreditCard, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

// Carousel Dots Component
const CarouselDots = ({ totalSlides, activeSlide, setActiveSlide }) => (
  <div className="flex justify-center gap-2 mt-4 mb-2">
    {Array.from({ length: totalSlides }).map((_, index) => (
      <button
        key={index}
        onClick={() => setActiveSlide(index)}
        className={`w-3 h-3 rounded-full transition-all duration-200 ${
          activeSlide === index
            ? 'bg-blue-500 scale-110'
            : 'bg-white/20 hover:bg-white/30'
        }`}
        aria-label={`Go to slide ${index + 1}`}
      />
    ))}
  </div>
);

const EmployeeProfileCarousel = ({
  activeSlide,
  setActiveSlide,
  totalSlides,
  renderSlideContent,
  slideData 
}) => {
  // Use refs to access DOM elements
  const carouselWrapperRef = useRef(null);
  const slideRefs = useRef([]);

  // Setup slide references
  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, totalSlides);
  }, [totalSlides]);

  // Get icon for the current slide
  const getSlideIcon = (index) => {
    switch (index) {
      case 0:
        return <User size={20} className="mr-2" />;
      case 1:
        return <CreditCard size={20} className="mr-2" />;
      case 2:
        return <Clock size={20} className="mr-2" />;
      default:
        return null;
    }
  };

  // Get title for the current slide
  const getSlideTitle = () => {
    switch (activeSlide) {
      case 0:
        return "Personal Information";
      case 1:
        return "ID Card";
      case 2:
        return "Attendance Records";
      default:
        return "";
    }
  };

  // Navigation functions
  const nextSlide = () => {
    setActiveSlide((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  return (
    <div className="carousel-outer">
      {/* Carousel Header with Navigation */}
      <div className="carousel-header">
        <button 
          onClick={prevSlide}
          className="carousel-arrow-btn"
          aria-label="Previous slide"
        >
          <ChevronLeft size={24} />
        </button>
        
        <h3 className="carousel-title">
          {getSlideIcon(activeSlide)}
          {getSlideTitle()}
        </h3>
        
        <button 
          onClick={nextSlide}
          className="carousel-arrow-btn"
          aria-label="Next slide"
        >
          <ChevronRight size={24} />
        </button>
      </div>
      
      {/* Navigation Dots */}
      <CarouselDots 
        totalSlides={totalSlides} 
        activeSlide={activeSlide} 
        setActiveSlide={setActiveSlide} 
      />
      
      {/* Carousel Content */}
      <div className="carousel-wrapper" ref={carouselWrapperRef}>
        {Array.from({ length: totalSlides }).map((_, index) => (
          <div 
            key={index}
            ref={el => slideRefs.current[index] = el}
            className={`carousel-slide ${activeSlide === index ? 'active' : ''}`}
            role="tabpanel"
            aria-hidden={activeSlide !== index}
            id={`slide-${index}`}
          >
            {renderSlideContent(index, slideData)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeProfileCarousel;