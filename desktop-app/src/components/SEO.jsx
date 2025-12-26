import React from 'react';

const SEO = ({ title, description, keywords }) => {
  React.useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  return null;
};

export default SEO;
