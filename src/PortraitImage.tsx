export function PortraitImage({src,alt,className=''}:{src:string;alt:string;className?:string}) {
  const match=/^medieval:([1-9])$/.exec(src);
  return <img className={className} src={match?`/assets/portrait-art-${match[1]}.jpg`:src || '/assets/portrait-placeholder.svg'} alt={alt}/>;
}
