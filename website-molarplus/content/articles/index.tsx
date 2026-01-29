import type { ComponentType } from 'react';
import WhyChoose from './why-choose-best-dental-software';
import Top5 from './top-5-dental-clinic-management-software';
import HowToChoose from './how-to-choose-dental-practice-management-software';
import DentalSoftwareIndia from './dental-software-india-guide';
import FeaturesThatMatter from './dental-clinic-software-features-that-matter';

export const articleContentMap: Record<string, ComponentType> = {
  'why-choose-best-dental-software': WhyChoose,
  'top-5-dental-clinic-management-software': Top5,
  'how-to-choose-dental-practice-management-software': HowToChoose,
  'dental-software-india-guide': DentalSoftwareIndia,
  'dental-clinic-software-features-that-matter': FeaturesThatMatter,
};
