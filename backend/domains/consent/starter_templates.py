"""The consent forms every clinic starts with.

Transcribed from the Dental Surgeons Association consent book (English pages
only; the book carries a Telugu translation of each form on the facing page,
which is not reproduced here).

─── Plain text, not HTML ───────────────────────────────────────────────────

`content` is plain text and every non-empty line becomes one paragraph. This
is not a style preference: consent_templates/classic.py renders the body with
html.escape() and wraps each line in <p>, because that body is patient-supplied
text on its way into a PDF and escaping it is the thing standing between this
and an injection. The previous version of this file was written in HTML tags,
which meant every clinic that adopted a form got a consent PDF showing the
patient a literal "<p>Please read this carefully</p>". Write prose, one
paragraph per line, and let the renderer do the rest.

─── What is NOT in here ────────────────────────────────────────────────────

No clinic name, no doctor name, no patient name, no signature or date lines.
The renderer already draws all of those — the clinic header, the patient box,
the signature section and the footer — from clinic settings. Repeating them in
the body prints them twice.

Two lines from the source book were deliberately dropped: "I am able to read
and write in the English language" and "I certify that I speak, read, and
write English". They are a US intake convention, and in a product that sends
these forms by WhatsApp to patients across several Indian languages, a clause
asserting the signer reads English is at best unverified and at worst a reason
the consent is worth less, not more. A clinic that wants it can add it.

─── Not legal advice ───────────────────────────────────────────────────────

These are a starting point and the UI says so. A clinic is expected to read
each one, adapt it to how it actually practises, and take its own advice.
"""

# Categories double as the grouping on the page, so a clinic scanning for
# "the extraction one" finds it by shape rather than by reading every name.
#
# Broader than the default set on purpose: these also categorise the forms a
# clinic writes itself, so the taxonomy outlives whatever ships as default.
CATEGORIES = [
    {"key": "surgical", "label": "Surgical", "description": "Extractions and oral surgery"},
    {"key": "endodontic", "label": "Root canal", "description": "Endodontic treatment"},
    {"key": "periodontal", "label": "Gums", "description": "Periodontal treatment and surgery"},
    {"key": "prosthodontic", "label": "Crowns and dentures", "description": "Prosthetic treatment"},
    {"key": "ortho", "label": "Orthodontics", "description": "Braces and aligners"},
    {"key": "paediatric", "label": "Children", "description": "Paediatric dental treatment"},
    {"key": "implant", "label": "Implants", "description": "Placement and restoration"},
    {"key": "sedation", "label": "Anaesthesia", "description": "Local and sedation"},
    {"key": "cosmetic", "label": "Cosmetic", "description": "Whitening and veneers"},
    {"key": "general", "label": "General", "description": "Examination and routine care"},
    {"key": "media", "label": "Photos and media", "description": "Clinical photography and marketing use"},
]


_ENDODONTIC = """\
The benefits of successful root canal treatment include the relief of pain and the ability to retain the tooth in comfort and function. I understand that during treatment, complications may arise which complicate treatment, make it more difficult, or require additional surgery. These complications include:
1. The possibility of a separated dental instrument, which may prevent successful treatment.
2. Perforations (accidental openings) of the crown or root of the tooth.
3. Identification of a crown or root fracture during or after treatment.
4. Damage to existing crowns, bridges or other appliances.
5. Root canal filling material which extends beyond the end of the root.
6. Blocked root canals, which may prevent successful treatment.
7. Loss of tooth structure, or weakening of the tooth.
8. Post-operative pain, swelling and/or infection.
9. A 5 to 10 per cent chance of failure.
10. Residual numbness, tingling or pain in the treated area.
Treatment alternatives include no treatment, or extraction.
I understand that root canal treatment weakens the crown of the tooth. I understand the need for a protective, permanent restoration (possibly a crown) after root canal treatment.
I understand that no guarantee of success has been or can be given. All of my questions have been answered and I fully understand all of the statements contained in this form.
I also understand that the costs of my treatment have been adequately explained to me."""


_ORAL_SURGERY = """\
I authorise the dentist named on this form and the clinic staff to perform the procedure that has been discussed with me, and to administer the anaesthesia agreed for it.
The anaesthesia options that have been explained to me are: local anaesthesia; local anaesthesia with oral pre-medication; local anaesthesia with nitrous oxide and oxygen analgesia; or another option recorded in my file.
I understand that certain complications may occur as a result of my surgery, which include but are not limited to swelling, bruising, and stiffness of the jaw muscles and jaw joints (TMJ) which may be long lasting, as well as unexpected drug reactions or allergies.
With tooth extraction, I understand that there may be unexpected damage to adjacent teeth or fillings; sharp ridges or bone splinters that may require later surgery to smooth or remove; dry socket, which will require additional care; or small fragments of tooth root which may be left in place to avoid damage to vital structures such as nerves or the sinus.
Lower tooth roots may lie very close to the nerve, and surgery may result in pain or a numb feeling of the chin, lip, cheek, gums, teeth or tongue lasting for weeks or months, and in rare cases permanently.
On upper teeth whose roots are close to the sinus, a sinus infection may develop, a root tip may enter the sinus, or an opening from the mouth to the sinus may occur, any of which could require later medication or surgery.
I understand that no guarantee can be promised, and I give my free and voluntary consent for treatment. I realise that my dentist may discover conditions requiring surgery different from that which was planned, and I give my permission for those additional procedures that are advisable in the exercise of professional judgement.
My signature on this form means that all of my questions have been answered to my satisfaction, and that I understand the risks involved in the proposed surgery and local anaesthesia."""


_ORTHODONTIC = """\
Orthodontic treatment is an elective procedure. Like other treatments of the body, it carries some inherent risks and limitations. These seldom prevent treatment, but they should be considered in making the decision to undergo it.
Predictable factors that can affect the outcome of orthodontic treatment
Cooperation. In the vast majority of orthodontic cases, significant improvement can be achieved with the patient's cooperation.
Caring for appliances. Poor brushing increases the risk of decay when wearing braces. Excellent oral hygiene, a reduction in sugar, being selective in diet, and reporting any loose bands as soon as they are noticed will help minimise decay, white spots (decalcification) and gum disease. Routine visits to your dentist every 3 to 6 months for cleaning and cavity checks are vital during treatment.
Wearing headgear and elastics. These place forces on the teeth so that they move into their proper positions, and the amount of time they are worn affects the result. They must be worn as instructed. If headgear is detached from the tubes or archwire while the elastic force is engaged, it can snap back and cause injury.
Keeping appointments. Missed appointments create scheduling problems and lengthen treatment time.
Unpredictable factors that can affect the outcome of orthodontic treatment
Muscle habits. Mouth breathing, thumb, finger or lip sucking, tongue thrusting (abnormal swallowing) and other unusual habits can prevent teeth from moving to their corrected positions, or cause relapse after braces are removed.
Facial growth patterns. Unusual skeletal patterns and insufficient or undesirable facial growth can compromise the dental result, affect facial change, and cause shifting of teeth during retention. Surgical assistance may be recommended in these situations.
Post-treatment tooth movement. Teeth have a tendency to shift or settle after treatment, and after retention. Some changes are desirable and others are not. Rotation and crowding of the lower front teeth, or slight spacing at an extraction site, are common examples.
Temporomandibular problems (TMJ). Jaw joint problems may develop before, during or after orthodontic treatment. Tooth positions, the bite, or pre-existing TMJ problems can be a factor in this condition.
Impacted teeth. In attempting to move impacted teeth (teeth unable to erupt normally), especially canines and third molars (wisdom teeth), problems are sometimes encountered which may lead to periodontal problems, relapse, or loss of teeth.
Root resorption. Shortening of the root ends can occur when teeth are moved during orthodontic treatment. Under healthy conditions, shortened roots are usually no problem. Trauma, impaction, endocrine disorders or idiopathic (unknown) reasons can also cause this. Severe resorption can increase the possibility of premature tooth loss.
Non-vital or dead tooth. A tooth that has been traumatised, or affected by other causes, can die over a long period of time, with or without orthodontic treatment. Such a tooth may discolour or flare up during orthodontic treatment, and may deteriorate during treatment, causing loss of bone around it. Excellent oral hygiene and frequent cleaning by your dentist can help control this.
Unusual occurrences. Swallowing appliances, chipped teeth, and dislodged restorations.
Using the retainers. I understand that retainers are given in different forms and that I will use them as explained to me by my orthodontist or dentist. Failing to use the retainers can lead to a change in tooth position.
I consent to the taking of photographs and x-rays before, during and after treatment, and to their use by the doctor in scientific papers or demonstrations.
I confirm that I have read, or had read to me, the contents of this form; that I understand the risks and limitations involved; and that I consent to orthodontic treatment."""


_PERIODONTAL = """\
I authorise the dentist named on this form to perform the periodontal surgical procedure that has been discussed with me and recorded in my file. The procedures this consent may cover are crown lengthening surgery, mucogingival (gingival graft) surgery, regenerative surgery with osseous grafts and/or guided tissue regeneration, and replaced flap surgery. A description of each is set out below.
I understand that I have a form of periodontal disease, or a periodontal condition, that has caused damage to the soft tissue and/or bone around my teeth. This disease or condition, if left untreated, is generally non-reversible and can be progressive, eventually leading to further damage and the possible loss of my teeth.
I also understand that a variety of surgical procedures are used to treat periodontal disease. While these treatments are generally successful, no guarantee, warranty or assurance has been given to me that the proposed treatment will be curative or successful to my complete satisfaction. A risk of failure, relapse or worsening of my present condition may remain despite the treatment.
It has been explained to me that the long-term success of treatment requires my cooperation, effective plaque control at home on a daily basis, and periodic periodontal maintenance visits at the clinic after the proposed surgical treatment has been performed.
I further understand that if no treatment is carried out, my present periodontal condition has the potential to worsen with time and may result in premature tooth loss.
I have been informed that other possible methods of treatment include scaling and root planing followed by periodic maintenance.
Although significant complications from periodontal surgery are rare, they can occur. During surgery they may include bleeding, perforation of the sinus membrane, and nerve damage. After surgery they may include bleeding, swelling, infection, discomfort, tooth sensitivity, tooth looseness, gum recession (shrinkage), numbness or altered sensation, and exposure of crown margins.
I understand that this procedure may be photographed and/or recorded on video.
I confirm that I have read and understand this consent to surgical treatment and the explanation given with it, and that all blanks were filled in or struck out before I signed.
About the procedures
Crown lengthening surgery. The purpose of this surgery is to expose more of the tooth to the mouth, for improved appearance, improved cleaning, or to allow the dentist to restore a badly broken-down tooth. To do this, the gum tissue and/or the bone around the teeth in question is reshaped by the surgeon.
Mucogingival surgery. The purpose of this surgery is to improve the appearance of the gums, cover exposed root surfaces, or provide more suitable gum tissue around the teeth. Gum tissue may be transplanted from one area of the mouth to another. The roof of the mouth is frequently used as the donor site, and a protective plastic liner may be used to protect the area the donor tissue is taken from.
Regenerative surgery. The purpose of this procedure is to regenerate oral tissue that has been lost, such as bone, cementum and periodontal ligament. Materials such as bone grafts and membranes may be used. These may come from human or animal donor sources. They are taken under sterile conditions from donors with no known systemic disease and with blood tests negative for infection, processed under sterile conditions, tested for bacterial contamination, and stored in a vacuum-sealed sterile container. While transmission of infection by an implanted biologic material can never be ruled out entirely, these materials are considered extremely safe because of strict processing procedures.
Replaced flap surgery. The purpose of this procedure is to gain access to the tooth and bone surfaces affected by periodontal disease. The gum tissue is reflected back, allowing the surgeon to see the teeth and bone. The root surfaces are then thoroughly cleaned and the gum tissue is replaced in its original position.
Other surgical procedures. The surgeon will describe the specifics of any procedure not covered by this form."""


_PROSTHODONTIC = """\
The benefits and risks of dental prosthetic treatment have been explained to me, and referral to a specialist (a prosthodontist) has been offered.
Dental prosthetic appliances may be fixed or removable. They are designed to replace missing teeth, they are made from a variety of materials, and the alternatives available have been explained to me, including the benefits of each.
I understand that an appliance may wear at different rates and may need replacement or re-fitting. Appliances that replace teeth include full dentures, partial dentures and fixed bridges, and they are retained in the mouth by a variety of methods.
The specific design proposed for my appliance, including the possible alternatives, has been explained to me. Where fixed prosthetics are proposed, including crowns (covering the entire tooth), inlays, onlays and laminates, the materials to be used and the alternatives available have been explained. Where a removable appliance is proposed, the materials involved have been explained.
I understand that removable dentures will not chew as efficiently as natural teeth, may acquire stains and odour, may retain food in certain spots, and will require relining in time because of changes in the gum tissue and the underlying bone.
I understand and accept the treatment recommended to me. I further understand that there may be some unwanted complications, and no guarantees have been made or implied.
Alternative treatments, and the option of no treatment, have been explained to me. I understand that the risks of no treatment may include, but are not limited to, problems with the bite and periodontal disease relating to teeth that have changed position or are under stress.
The risks and unwanted consequences of the proposed prosthodontic treatment may include, but are not limited to: a reaction to medication or anaesthetic; numbness caused by the pressure of a removable denture, requiring an adjustment or another procedure; the potential need for root canal treatment after a tooth is prepared; the need for periodontal treatment and home care; breakage of the appliance or fracture of porcelain; recurrent decay; wear of the teeth opposing the prosthesis in the other jaw; changes in speech; temporomandibular joint dysfunction caused by changes in the bite, which may require additional treatment; problems with the stability or movement of the appliance, including the retention of a removable appliance; and damage to adjacent teeth or restorations.
All of my questions have been addressed and the proposed fees have been explained to me.
I have read and understand the above information, together with the information given to me verbally, and I consent to the treatment described here."""


_PAEDIATRIC = """\
I understand that the dentist and the dental assistant may treat my child with the dental procedures necessary to provide dental treatment, and that I will be told why each treatment is being carried out.
For a first visit, the usual procedure may include a comprehensive or limited examination, a dental cleaning, fluoride application, sealants and radiographs as necessary. This is subject to change depending on a number of factors, including my child's behaviour, the amount of work needed and the time available.
The procedures this consent may cover are:
1. Application of sealants.
2. Root canal treatment for permanent teeth, and pulpotomy for primary teeth.
3. Porcelain crowns or stainless steel crowns.
4. Restoration of broken teeth, fillings, and treatment of infected teeth or gums.
5. Extraction of one or more teeth.
6. The use of supports to safely perform necessary dental procedures.
7. The use of nitrous oxide to help reduce anxiety, as needed.
8. The use of local anaesthetics, oral anaesthesia or oral sedatives, as needed.
My child's treatment, the alternative methods of treatment, and the advantages and disadvantages of each have been explained to me. Although the best results are expected, there is no reasonable way of anticipating every complication, so the results of treatment cannot be guaranteed. Although the occurrence is remote, it is known that some risks are associated with dental procedures. I understand and accept that certain complications may be serious or may require medical intervention.
If I am not present for my child's appointment, I give permission for the adult named in my child's file to make decisions concerning my child's dental treatment and the payment for it."""


STARTER_TEMPLATES = [
    {
        "name": "Consent for endodontic (root canal) treatment",
        "category": "endodontic",
        "content": _ENDODONTIC,
    },
    {
        "name": "Consent for oral and maxillofacial surgery and anaesthesia",
        "category": "surgical",
        "content": _ORAL_SURGERY,
    },
    {
        "name": "Consent for orthodontic treatment",
        "category": "ortho",
        "content": _ORTHODONTIC,
    },
    {
        "name": "Consent to periodontal surgery",
        "category": "periodontal",
        "content": _PERIODONTAL,
    },
    {
        "name": "Informed consent for prosthodontic treatment",
        "category": "prosthodontic",
        "content": _PROSTHODONTIC,
    },
    {
        "name": "Paediatric dental treatment consent",
        "category": "paediatric",
        "content": _PAEDIATRIC,
    },
]
