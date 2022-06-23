import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Peer to peer',
    // Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Sonar is based on the{' '}
        <a href='https://hypercore-protocol.org/'>Hypercore Protocol</a> and
        part of the <a href='https://dat.foundation'>Dat</a> ecosystem of
        peer-to-peer tools.
      </>
    ),
  },
  {
    title: 'Full-text search',
    // Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Sonar includes the{' '}
        <a href='https://github.com/tantivy-search/tantivy'>Tantivy</a>{' '}
        full-text search engine.
      </>
    ),
  },
  {
    title: 'Community focused',
    // Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Sonar is a young open source project. We want to enable people to build
        tools for local-first content archives and media libraries.
      </>
    )
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg && <Svg className={styles.featureSvg} role="img" />}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
