import { showroomDetails, verifiedMapHref } from '@/lib/showroom-details';

export function ShowroomDetails() {
  const map=verifiedMapHref(showroomDetails.mapUrl);
  return <div className="showroom-details"><p className="showroom-details-label">Visit us in Wadala</p><address>{showroomDetails.address}</address>
    {showroomDetails.businessHours&&<div className="showroom-hours"><p className="showroom-details-label">Business hours</p><p>{showroomDetails.businessHours}</p></div>}
    {map&&<a className="text-link" href={map} target="_blank" rel="noopener noreferrer">View directions <span aria-hidden="true">↗</span><span className="sr-only"> (opens a map in a new tab)</span></a>}
    {!showroomDetails.businessHours&&<p className="showroom-visit-note">Please confirm visiting hours with the showroom before travelling.</p>}
  </div>;
}
