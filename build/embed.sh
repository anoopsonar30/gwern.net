#!/bin/bash

# similar.sh: get a neural net summary (embedding) of a text string (usually an annotation)
# Author: Gwern Branwen
# Date: 2021-12-05
# When:  Time-stamp: "2021-12-05 22:13:44 gwern"
# License: CC-0
#
# Shell script to pass a document into the OpenAI API Embedding endpoint (https://beta.openai.com/docs/api-reference/embeddings). Authentication via shell environment variable.
#
# Example:
# $ embed.sh "foo bar"
# # ada-similarity-model:2021-09-01
# # [
# #   0.027102030813694,
# #   0.006181434262543917,
# # ... ]
#
# Because an embedding is unique to each model, and embeddings generated by different models can't be easily compared, it is important to track the model+version that generated it. Separated by a newline, a JSON array of 1024–12288 floats (depending on model size; bigger = more = better) follows and is the actual embedding.
#
# Requires: curl, jq, valid API key defined in `$OPENAI_API_KEY`

# set -e
# set -x

# Input: 2048 BPEs of text
# Output: https://beta.openai.com/docs/guides/embeddings/types-of-embedding-models ada-similarity [1024], babbage-similarity [2048], curie-similarity [4096], davinci-similarity [12288, or 12×]
ENGINE="ada-similarity"
TEXT="$1"
TEXT_LENGTH="${#TEXT}"

while [ $TEXT_LENGTH -gt 0 ]; do

    RESULT="$(curl --silent "https://api.openai.com/v1/engines/$ENGINE/embeddings" -H "Content-Type: application/json" -H "Authorization: Bearer $OPENAI_API_KEY" \
         -d "{\"input\": \"$TEXT\"}")"
    PARSED="$(echo "$RESULT" | jq --raw-output '.model, .data[0].embedding')"

    if [ "$PARSED" = "null
null" ]; then
        echo "Length error? $TEXT_LENGTH $(echo $RESULT | jq .)" 1>&2
        TEXT_LENGTH="$(($TEXT_LENGTH - 200))"
        TEXT="${TEXT:0:$TEXT_LENGTH}"
    else
        echo "$PARSED"
        break
    fi
done

# Example output:
#  $ curl --silent 'https://api.openai.com/v1/engines/ada-similarity/embeddings' -H "Content-Type: application/json" -H "Authorization: Bearer $OPENAI_API_KEY" -d '{"input": "Sample document text goes here"}' | jq --raw-output '.model, .data[0].embedding'
# ada-similarity-model:2021-09-01
# [
#   0.027102030813694,
#   0.006181434262543917,
#   -0.027859985828399658,
#   0.02767561934888363,
#   0.004647598601877689,
#   0.028802309185266495,
#   0.020935960114002228,
#   0.009028889238834381,
#   0.037283215671777725,
#   -0.00509571423754096,
#   -0.006417015101760626,
#   -0.003656623186543584,
#   0.02613922208547592,
#   0.02407020889222622,
#   0.004517005290836096,
#   -0.050844475626945496,
#   0.0015684046084061265,
#   0.010370675474405289,
#   0.009095465764403343,
#   0.001898729708045721,
#   0.016490653157234192,
#   -0.010350190103054047,
#   0.02096668817102909,
#   -0.01744321919977665,
#   0.03412848338484764,
#   0.022533811628818512,
#   -0.0031854617409408092,
#   0.030482102185487747,
#   -0.025422237813472748,
#   0.003930613864213228,
#   -0.0692402571439743,
#   -0.008460422046482563,
#   0.02163245901465416,
#   0.08042522519826889,
#   0.013274463824927807,
#   -0.02484864927828312,
#   -0.05518735572695732,
#   -0.01940980739891529,
#   -0.0014698191080242395,
#   0.04785362258553505,
#   -0.0477307103574276,
#   -0.04144173115491867,
#   -0.009392502717673779,
#   0.005134124308824539,
#   -0.01745346188545227,
#   0.018272873014211655,
#   -0.04883691668510437,
#   -0.00670380936935544,
#   -0.02953977882862091,
#   0.0033698291517794132,
#   -0.01587609574198723,
#   0.039434172213077545,
#   -0.019071798771619797,
#   -0.010949384421110153,
#   -0.001506948727183044,
#   -0.02689717710018158,
#   0.0028781823348253965,
#   -0.01745346188545227,
#   -0.05354853346943855,
#   0.04465791955590248,
#   -0.017586616799235344,
#   -0.0024646357633173466,
#   0.01189170777797699,
#   -0.012936457060277462,
#   -0.040888626128435135,
#   -0.030564043670892715,
#   -0.0027399067766964436,
#   -0.017904138192534447,
#   -0.014104117639362812,
#   -0.03998727351427078,
#   -0.01589658111333847,
#   0.015538088046014309,
#   -0.00916716456413269,
#   0.006734536960721016,
#   0.004655280616134405,
#   -0.003444088390097022,
#   0.013807081617414951,
#   -0.023660503327846527,
#   0.009320803917944431,
#   -0.008071201853454113,
#   0.011604913510382175,
#   -0.005812699440866709,
#   0.01457527931779623,
#   -0.04125736281275749,
#   0.0063709234818816185,
#   0.0033570260275155306,
#   -0.026958633214235306,
#   -0.01178928092122078,
#   -0.013294949196279049,
#   -0.013141309842467308,
#   0.02476670779287815,
#   -0.02243138663470745,
#   -0.004517005290836096,
#   -0.0368325412273407,
#   -0.024029238149523735,
#   -0.04158512502908707,
#   -0.038655731827020645,
#   -0.02331225387752056,
#   -0.012588206678628922,
#   0.021038386970758438,
#   0.00965881161391735,
#   0.00582294212654233,
#   -0.029027648270130157,
#   -0.05150000378489494,
#   -0.006877934094518423,
#   0.0205569826066494,
#   0.0022008877713233232,
#   -0.004552854225039482,
#   -0.0011791841825470328,
#   -0.00772295193746686,
#   0.04756683111190796,
#   0.04103202372789383,
#   -0.008516756817698479,
#   -0.04023309797048569,
#   0.07206723093986511,
#   0.02972414717078209,
#   0.009213256649672985,
#   0.05875179544091225,
#   -0.010662590153515339,
#   0.031055690720677376,
#   0.005935611203312874,
#   -0.0573178231716156,
#   0.04076571390032768,
#   0.0019076920580118895,
#   -0.005725637078285217,
#   -0.0017809394048526883,
#   -0.013172037899494171,
#   0.010227277874946594,
#   0.005100835580378771,
#   -0.014841588214039803,
#   0.005397872533649206,
#   0.037180788815021515,
#   -0.01658283732831478,
#   -0.022287989035248756,
#   -0.01155370008200407,
#   -0.03404654189944267,
#   -0.01165612693876028,
#   0.0411139652132988,
#   0.04764876887202263,
#   -0.028249206021428108,
#   0.0004036241152789444,
#   -0.008649910800158978,
#   0.008086565881967545,
#   -0.02388584055006504,
#   0.00011026844003936276,
#   0.00014155652024783194,
#   -0.022349445149302483,
#   -0.014513824135065079,
#   0.029683176428079605,
#   -0.0015146307414397597,
#   -0.0039536599069833755,
#   0.0228206068277359,
#   0.00716472789645195,
#   0.05256523936986923,
#   0.012147773057222366,
#   0.04584606736898422,
#   -0.01242432463914156,
#   -0.03804117068648338,
#   0.008081444539129734,
#   0.008941826410591602,
#   0.002364770043641329,
#   -0.0017796590691432357,
#   -0.026589898392558098,
#   0.017392005771398544,
#   0.036791570484638214,
#   0.0053517804481089115,
#   -0.041871920228004456,
#   0.020782319828867912,
#   -0.0003940216265618801,
#   -0.020403342321515083,
#   -0.014237272553145885,
#   0.014974742196500301,
#   0.007559069897979498,
#   0.011420546099543571,
#   -0.024623312056064606,
#   -0.029601234942674637,
#   0.0036258953623473644,
#   -0.0025683424901217222,
#   -0.031240059062838554,
#   -0.0071596065536141396,
#   0.03218238055706024,
#   0.0013648320455104113,
#   -0.00925422739237547,
#   0.001965306932106614,
#   0.04115493595600128,
#   -0.01843675598502159,
#   0.025975340977311134,
#   0.02720445767045021,
#   -0.011820008978247643,
#   0.021222753450274467,
#   0.010380917228758335,
#   -0.007226184010505676,
#   0.037221759557724,
#   0.050844475626945496,
#   -0.002533773658797145,
#   0.005991945508867502,
#   0.039044950157403946,
#   -0.03859427571296692,
#   -0.032796937972307205,
#   -0.01306961104273796,
#   0.0032622814178466797,
#   0.01891816034913063,
#   0.03156782314181328,
#   -0.00025766645558178425,
#   -0.0028525758534669876,
#   0.03335004299879074,
#   0.028884250670671463,
#   0.02144809253513813,
#   -0.02562708966434002,
#   0.005062425974756479,
#   0.011820008978247643,
#   -0.04662450775504112,
#   0.037877291440963745,
#   0.009771480225026608,
#   -0.02962172031402588,
#   -0.016879873350262642,
#   -0.03507080674171448,
#   -0.06186555698513985,
#   0.0026912542525678873,
#   0.03314518928527832,
#   0.0031675370410084724,
#   -0.02251332625746727,
#   -0.0055259051732718945,
#   -0.032120924443006516,
#   0.06280788034200668,
#   -0.03398508578538895,
#   -0.020833533257246017,
#   -0.0205569826066494,
#   -0.015118139795958996,
#   0.008470664732158184,
#   0.043633654713630676,
#   -0.0011951882624998689,
#   -0.00010682755237212405,
#   -0.0067499009892344475,
#   0.024705251678824425,
#   -0.03136296942830086,
#   0.030686955899000168,
#   0.029416868463158607,
#   0.03267402946949005,
#   0.034456249326467514,
#   0.006186555605381727,
#   -0.00877282302826643,
#   -0.018764520063996315,
#   0.018754277378320694,
#   -0.015589301474392414,
#   -0.004593824967741966,
#   0.0017374081071466208,
#   -0.003024140140041709,
#   0.02767561934888363,
#   0.029416868463158607,
#   -0.022554297000169754,
#   0.0036719872150570154,
#   0.04818138852715492,
#   -0.015415175817906857,
#   0.002957562915980816,
#   0.015271779149770737,
#   -0.0433058887720108,
#   0.016511138528585434,
#   0.03363683819770813,
#   0.021284209564328194,
#   -0.0368325412273407,
#   0.029293956235051155,
#   -0.0043915328569710255,
#   -0.03673011437058449,
#   -0.014114360325038433,
#   0.011604913510382175,
#   -0.0205569826066494,
#   0.020710622891783714,
#   -0.011748310178518295,
#   0.01013509463518858,
#   -0.01554833073168993,
#   -0.00506754731759429,
#   -0.03234626352787018,
#   0.0023442846722900867,
#   0.04338783025741577,
#   -0.02835163287818432,
#   0.013213008642196655,
#   -0.03617701306939125,
#   -0.0058997618034482,
#   0.05993993952870369,
#   0.047812651842832565,
#   0.03750855475664139,
#   -0.027634648606181145,
#   -0.0017860607476904988,
#   -0.030072396621108055,
#   0.03345246985554695,
#   -0.05465473607182503,
#   -0.018569910898804665,
#   -0.021673429757356644,
#   0.007343974430114031,
#   0.0411139652132988,
#   -0.017381763085722923,
#   0.037488069385290146,
#   -0.31416231393814087,
#   0.02380390092730522,
#   -0.027716590091586113,
#   0.04240453615784645,
#   0.007850985042750835,
#   0.02603679522871971,
#   -0.0027783166151493788,
#   -0.005807578098028898,
#   0.024705251678824425,
#   0.0027936806436628103,
#   -0.0012713678879663348,
#   -0.01792462356388569,
#   0.0052698394283652306,
#   -0.02642601728439331,
#   0.007692224346101284,
#   0.009223499335348606,
#   0.005869033746421337,
#   -0.009110829792916775,
#   -0.02183731272816658,
#   0.04045843705534935,
#   -0.025668060407042503,
#   0.01554833073168993,
#   -0.0026554048527032137,
#   -0.0018091066740453243,
#   -0.02534029632806778,
#   -0.01101084053516388,
#   0.05797335505485535,
#   0.03853281959891319,
#   -0.005730758421123028,
#   0.0438385084271431,
#   -0.011328361928462982,
#   0.008721609599888325,
#   0.027552707120776176,
#   0.006883055437356234,
#   -0.01753540337085724,
#   -0.007738315965980291,
#   0.049287594854831696,
#   -0.007026452571153641,
#   0.004012554883956909,
#   -0.0208745039999485,
#   0.014513824135065079,
#   -0.009290075860917568,
#   0.03404654189944267,
#   0.008880370296537876,
#   0.041749007999897,
#   -0.014483096078038216,
#   -0.03615652769804001,
#   -0.018467484042048454,
#   -0.006104614585638046,
#   0.03171122074127197,
#   0.00033160552266053855,
#   -0.08079396188259125,
#   0.021489063277840614,
#   0.037672437727451324,
#   -0.03779534995555878,
#   0.07731146365404129,
#   0.016593080013990402,
#   0.028679396957159042,
#   0.0035285900812596083,
#   -0.019153740257024765,
#   0.026938147842884064,
#   0.007374702021479607,
#   0.0160809475928545,
#   -0.03687351197004318,
#   0.010498708114027977,
#   -0.039823390543460846,
#   -0.0029165924061089754,
#   0.02047504112124443,
#   -0.004865254741162062,
#   0.04838624224066734,
#   -0.01091865636408329,
#   0.03205946832895279,
#   0.049369536340236664,
#   0.009146679192781448,
#   0.03666865825653076,
#   -0.06428281962871552,
#   0.0013052966678515077,
#   -0.002657965524122119,
#   0.012844272889196873,
#   -0.0068420846946537495,
#   -0.01521032303571701,
#   -0.02486913464963436,
#   0.0030779140070080757,
#   -0.0009954568231478333,
#   0.03314518928527832,
#   0.002561940811574459,
#   0.002407020889222622,
#   0.04162609577178955,
#   0.0037360037676990032,
#   -0.011840494349598885,
#   0.018375299870967865,
#   0.013520287349820137,
#   0.0019998757634311914,
#   -0.005725637078285217,
#   -0.02935541234910488,
#   -0.008854763582348824,
#   -0.009325925260782242,
#   0.028023868799209595,
#   0.022287989035248756,
#   0.021796341985464096,
#   -0.01306961104273796,
#   0.041298333555459976,
#   0.01579415425658226,
#   -0.006626989226788282,
#   -0.0004846049996558577,
#   0.011717582121491432,
#   -0.010211913846433163,
#   -0.03482498228549957,
#   -0.023517105728387833,
#   -0.010703560896217823,
#   0.012741846963763237,
#   -0.028413088992238045,
#   0.01164588425308466,
#   -0.048673033714294434,
#   0.008824036456644535,
#   0.028617942705750465,
#   -0.028822794556617737,
#   0.0200960636138916,
#   -0.0011849456932395697,
#   0.046337712556123734,
#   -0.03615652769804001,
#   -0.010217035189270973,
#   0.010304098017513752,
#   0.020331643521785736,
#   0.01773001253604889,
#   0.0022316155955195427,
#   -0.04715712368488312,
#   0.030441131442785263,
#   0.0015568815870210528,
#   0.03810262680053711,
#   0.022103620693087578,
#   0.05379435420036316,
#   0.0003946617944166064,
#   -0.027327368035912514,
#   -0.026487471535801888,
#   -0.019952666014432907,
#   -0.02572951652109623,
#   -0.042445506900548935,
#   -0.030830351635813713,
#   -0.013551015406847,
#   0.0025747441686689854,
#   -0.016531623899936676,
#   -0.032715000212192535,
#   -0.009213256649672985,
#   -0.03246917575597763,
#   0.0035055442713201046,
#   0.019430292770266533,
#   0.02837211824953556,
#   0.000779721129219979,
#   -0.023148370906710625,
#   -0.021079357713460922,
#   0.04133930429816246,
#   0.007343974430114031,
#   -0.04998409375548363,
#   0.014636735431849957,
#   0.020393099635839462,
#   0.020003879442811012,
#   0.007466886192560196,
#   -0.014124603010714054,
#   0.0035132262855768204,
#   0.011574185453355312,
#   -0.010329704731702805,
#   -0.05957120656967163,
#   0.0028756216634064913,
#   -0.012885243631899357,
#   -0.00020389258861541748,
#   -0.027737075462937355,
#   0.01492352969944477,
#   0.017955351620912552,
#   -0.0036054099909961224,
#   -0.05072156339883804,
#   -0.06727367639541626,
#   -0.04002824425697327,
#   0.042937155812978745,
#   -0.03830748051404953,
#   0.0009429632336832583,
#   0.004583582282066345,
#   0.029416868463158607,
#   0.015425418503582478,
#   0.06002188101410866,
#   -0.06063644215464592,
#   0.0111542372033,
#   -0.01638822630047798,
#   -0.0033826325088739395,
#   -0.004199483431875706,
#   0.03021579422056675,
#   0.04219968616962433,
#   -0.015517602674663067,
#   0.002513288287445903,
#   0.03187510371208191,
#   0.014739162288606167,
#   -0.006801114417612553,
#   -0.0674375519156456,
#   0.0009589673718437552,
#   0.016521381214261055,
#   0.01833432912826538,
#   0.05449085682630539,
#   0.041564639657735825,
#   -0.019348351284861565,
#   -0.011840494349598885,
#   -0.012649662792682648,
#   0.036115556955337524,
#   -0.012598449364304543,
#   0.04818138852715492,
#   0.000282312830677256,
#   -0.009571748785674572,
#   -0.1019347757101059,
#   -0.03998727351427078,
#   -0.04707518219947815,
#   0.005930489860475063,
#   0.047239065170288086,
#   -0.00652968417853117,
#   -0.00867039617151022,
#   -0.021366151049733162,
#   -0.025422237813472748,
#   0.023148370906710625,
#   -0.0020984613802284002,
#   0.039536599069833755,
#   0.0057410006411373615,
#   -0.01345883123576641,
#   0.009520535357296467,
#   -0.009074980393052101,
#   0.010836714878678322,
#   0.03203898295760155,
#   0.02417263574898243,
#   0.024787193164229393,
#   0.012721361592411995,
#   0.013131067156791687,
#   0.0024543930776417255,
#   -0.007256912067532539,
#   0.014339698478579521,
#   -0.02818775177001953,
#   0.022369930520653725,
#   0.0012988949893042445,
#   -0.00018884871678892523,
#   0.0026835722383111715,
#   -0.037098851054906845,
#   0.02134566567838192,
#   0.007989260368049145,
#   -0.029580749571323395,
#   -0.010211913846433163,
#   0.007589797955006361,
#   -0.04613285884261131,
#   -0.014237272553145885,
#   0.0032315535936504602,
#   0.023025458678603172,
#   -0.0391678623855114,
#   0.028617942705750465,
#   -0.012004376389086246,
#   -0.011594670824706554,
#   0.003415921004489064,
#   0.03351392596960068,
#   -0.018170446157455444,
#   -0.03730370104312897,
#   -0.0077895293943583965,
#   -0.015220565721392632,
#   -0.00031896226573735476,
#   -0.0007688383338972926,
#   0.026876691728830338,
#   0.025913884863257408,
#   -0.006693566683679819,
#   -0.04248647764325142,
#   0.006626989226788282,
#   0.030666470527648926,
#   0.031117146834731102,
#   0.02603679522871971,
#   0.009443716146051884,
#   0.005059865303337574,
#   -0.020925717428326607,
#   -0.031731706112623215,
#   0.05301591381430626,
#   -0.00031992251751944423,
#   -0.0033442226704210043,
#   0.03040016070008278,
#   -0.017914380878210068,
#   -0.1727319210767746,
#   0.022882062941789627,
#   -0.028699882328510284,
#   -0.005113638937473297,
#   -0.05711297318339348,
#   0.0008354154997505248,
#   -0.0035798032768070698,
#   -0.04269133135676384,
#   0.01863136515021324,
#   -0.02017800509929657,
#   0.016982300207018852,
#   -0.03496837988495827,
#   -0.00026150746271014214,
#   0.03341149911284447,
#   -0.030584529042243958,
#   0.0025632211472839117,
#   0.009479565545916557,
#   -0.05866985395550728,
#   -0.037385642528533936,
#   0.008096808567643166,
#   -0.0009436034015379846,
#   0.033001791685819626,
#   0.035234689712524414,
#   0.0011260504834353924,
#   -0.004499080590903759,
#   0.02601630985736847,
#   -0.0290481336414814,
#   0.027409309521317482,
#   -0.0005662260809913278,
#   -0.014349941164255142,
#   -0.0008366958354599774,
#   0.009151800535619259,
#   0.04891885817050934,
#   0.005879276432096958,
#   0.021796341985464096,
#   -0.003405678551644087,
#   -0.00042282906360924244,
#   0.01921519637107849,
#   -0.022984487935900688,
#   -0.0009103147895075381,
#   0.03080986812710762,
#   -0.0469522699713707,
#   0.008813793770968914,
#   -0.0032802061177790165,
#   0.0028961070347577333,
#   0.055310267955064774,
#   0.07137072831392288,
#   -0.04045843705534935,
#   -0.010949384421110153,
#   -0.02378341555595398,
#   -0.02126372419297695,
#   -0.02243138663470745,
#   -0.035152748227119446,
#   0.008982797153294086,
#   -0.07268178462982178,
#   0.0068420846946537495,
#   0.02816726639866829,
#   0.035439539700746536,
#   0.03998727351427078,
#   0.006319710053503513,
#   0.0674375519156456,
#   0.005397872533649206,
#   -0.051418062299489975,
#   0.03822553902864456,
#   0.037979718297719955,
#   0.00482684513553977,
#   0.003574682166799903,
#   0.008655032142996788,
#   -0.01243456732481718,
#   -0.014882558956742287,
#   -0.018590394407510757,
#   0.011707339435815811,
#   0.04080668464303017,
#   -0.0006216003093868494,
#   0.007876591756939888,
#   0.020587710663676262,
#   0.056580353528261185,
#   0.04482180252671242,
#   -0.0325511172413826,
#   0.0003780175175052136,
#   0.014882558956742287,
#   0.0356648787856102,
#   0.051049329340457916,
#   0.014227029867470264,
#   -0.019624901935458183,
#   0.03291985020041466,
#   0.007938047870993614,
#   -0.0031905830837786198,
#   -0.0653480589389801,
#   -0.008798429742455482,
#   -0.008409209549427032,
#   -0.0006824160227552056,
#   0.011707339435815811,
#   -0.01492352969944477,
#   0.0014173255767673254,
#   0.012321898713707924,
#   0.012332141399383545,
#   -0.007354217115789652,
#   -0.006319710053503513,
#   0.01950198970735073,
#   -0.0022713057696819305,
#   0.009761237539350986,
#   -0.028495030477643013,
#   0.053179796785116196,
#   0.006299224682152271,
#   -0.036136042326688766,
#   -0.008363117463886738,
#   -0.02652844227850437,
#   0.03642283380031586,
#   -0.005134124308824539,
#   -0.04095008224248886,
#   0.051622916013002396,
#   0.03580827638506889,
#   -0.007425915449857712,
#   0.014462610706686974,
#   0.0037180790677666664,
#   0.025422237813472748,
#   -0.01428848598152399,
#   -0.016511138528585434,
#   0.022001195698976517,
#   -0.017473947256803513,
#   -0.01579415425658226,
#   0.04142124578356743,
#   -0.02915055863559246,
#   -0.04826333001255989,
#   0.018856704235076904,
#   -0.025463208556175232,
#   0.038758158683776855,
#   0.020311160013079643,
#   -0.02066965214908123,
#   0.020403342321515083,
#   0.027737075462937355,
#   0.0255451500415802,
#   0.029109587892889977,
#   0.003759049577638507,
#   0.027716590091586113,
#   -0.02212410606443882,
#   0.05953023582696915,
#   0.010898170992732048,
#   -0.007518099155277014,
#   0.017801711335778236,
#   0.018283115699887276,
#   0.01841627061367035,
#   -0.0005070107872597873,
#   0.03859427571296692,
#   0.03556245192885399,
#   -0.01860063709318638,
#   0.013878779485821724,
#   -0.005164852365851402,
#   0.00814290065318346,
#   -0.021489063277840614,
#   0.03646380454301834,
#   -0.010795745067298412,
#   -0.004762828350067139,
#   0.014483096078038216,
#   -0.020157519727945328,
#   -0.014237272553145885,
#   0.037590496242046356,
#   0.028044354170560837,
#   -0.02046479843556881,
#   -0.003648941172286868,
#   -0.02331225387752056,
#   0.009325925260782242,
#   -0.010232399217784405,
#   -0.017504675313830376,
#   -0.04256841912865639,
#   -0.010452616028487682,
#   0.005915125831961632,
#   -0.008076323196291924,
#   -0.009827814996242523,
#   -0.008265811949968338,
#   0.02310740016400814,
#   0.008562848903238773,
#   -0.0027014969382435083,
#   0.012455052696168423,
#   -0.05449085682630539,
#   -0.02163245901465416,
#   0.02925298549234867,
#   -0.006929147522896528,
#   0.013131067156791687,
#   -0.011953162960708141,
#   -0.019461018964648247,
#   -0.02652844227850437,
#   0.009853421710431576,
#   -0.009151800535619259,
#   0.012455052696168423,
#   -0.010836714878678322,
#   0.011000597849488258,
#   -0.008153143338859081,
#   -0.01968635804951191,
#   -0.04318298026919365,
#   0.012342384085059166,
#   0.02407020889222622,
#   0.007922683842480183,
#   -0.01979902759194374,
#   0.010129973292350769,
#   0.012147773057222366,
#   -0.02534029632806778,
#   0.008900855667889118,
#   -0.0216529443860054,
#   -0.023066429421305656,
#   0.010001939721405506,
#   -0.0025184096302837133,
#   0.028249206021428108,
#   -0.0015415176749229431,
#   0.01967611536383629,
#   0.04158512502908707,
#   0.009786844253540039,
#   -0.04066328704357147,
#   -0.03187510371208191,
#   0.031629279255867004,
#   0.0005479813553392887,
#   0.004931832198053598,
#   0.03423091024160385,
#   0.03373926132917404,
#   0.020741350948810577,
#   0.04691129922866821,
#   0.019532717764377594,
#   0.06506126374006271,
#   0.01291597168892622,
#   0.045477330684661865,
#   0.04650159552693367,
#   -0.0020472481846809387,
#   -0.02767561934888363,
#   0.014011934399604797,
#   -0.00046347954776138067,
#   0.02045455574989319,
#   -0.02962172031402588,
#   0.04248647764325142,
#   0.012967185117304325,
#   0.02806483954191208,
#   0.09677248448133469,
#   0.01637798547744751,
#   0.0014198862481862307,
#   -0.035828761756420135,
#   -0.019563445821404457,
#   0.00120543094817549,
#   -0.0215300340205431,
#   -0.03011336736381054,
#   -0.0110210832208395,
#   -0.0032341142650693655,
#   -0.006606504321098328,
#   0.04017164185643196,
#   -0.04895982891321182,
#   -0.046542566269636154,
#   0.014001691713929176,
#   0.025954855605959892,
#   0.012158015742897987,
#   -0.02650795690715313,
#   0.024213606491684914,
#   0.0290481336414814,
#   -0.01091865636408329,
#   -0.024336516857147217,
#   0.018938645720481873,
#   0.08017940074205399,
#   -0.024643797427415848,
#   0.027081545442342758,
#   -0.0042302110232412815,
#   0.04445306584239006,
#   0.03818456828594208,
#   0.021878283470869064,
#   0.04818138852715492,
#   0.029683176428079605,
#   0.025114959105849266,
#   0.002732224762439728,
#   -0.017422733828425407,
#   0.06231623515486717,
#   -0.007461764849722385,
#   0.00109724304638803,
#   -0.022677209228277206,
#   0.03752904012799263,
#   0.022554297000169754,
#   0.05010700598359108,
#   -0.014083633199334145,
#   -0.04977924004197121,
#   -0.020823290571570396,
#   0.03623846918344498,
#   0.006314588710665703,
#   0.01725885272026062,
#   -0.0024403093848377466,
#   -0.003059989307075739,
#   -0.017893895506858826,
#   -0.010969869792461395,
#   0.05096738785505295,
#   -0.03924980387091637,
#   -0.00039658229798078537,
#   -0.008875248953700066,
#   -0.00010266648314427584,
#   0.033391013741493225,
#   0.01892840303480625,
#   -0.039925817400217056,
#   -0.031342484056949615,
#   -0.02806483954191208,
#   0.02290254831314087,
#   0.006995724514126778,
#   0.028495030477643013,
#   -0.013213008642196655,
#   -0.004563096910715103,
#   -0.004645037930458784,
#   0.0034773768857121468,
#   0.017023270949721336,
#   0.002376292832195759,
#   -0.021427607163786888,
#   0.02513544261455536,
#   0.08915195614099503,
#   0.016019491478800774,
#   -0.015220565721392632,
#   0.0009602477075532079,
#   -0.038368936628103256,
#   -0.014360183849930763,
#   -0.008055837824940681,
#   0.004125223960727453,
#   -0.11693000048398972,
#   0.014636735431849957,
#   -0.010467980057001114,
#   -0.008578212931752205,
#   -0.006027794908732176,
#   0.029171044006943703,
#   0.04740294814109802,
#   -0.000855900754686445,
#   -0.012844272889196873,
#   0.0022111304569989443,
#   0.022636238485574722,
#   -0.046747419983148575,
#   0.0033467833418399096,
#   -0.03306324779987335,
#   -0.018477726727724075,
#   0.004476034548133612,
#   0.013622714206576347,
#   -0.02689717710018158,
#   -0.014944015070796013,
#   0.01589658111333847,
#   -0.013530530035495758,
#   0.012711118906736374,
#   -0.011174722574651241,
#   -0.022287989035248756,
#   0.040212612599134445,
#   0.018487969413399696,
#   0.05772753059864044,
#   -0.04531344771385193,
#   -0.032202865928411484,
#   0.02777804434299469,
#   -0.0023250796366482973,
#   -0.007763922680169344,
#   0.0027731952723115683,
#   -0.029089102521538734,
#   0.015763426199555397,
#   0.022636238485574722,
#   -0.00018788846500683576,
#   0.011205450631678104,
#   0.0040458436124026775,
#   -0.00916204322129488,
#   -0.022349445149302483,
#   0.005310809705406427,
#   -0.0008283736533485353,
#   0.023271283134818077,
#   0.008025109767913818,
#   0.0021061431616544724,
#   -0.307115375995636,
#   -0.0456412136554718,
#   0.00867039617151022,
#   -0.010539678856730461,
#   0.006237769033759832,
#   -0.006688445340842009,
#   0.004604067653417587,
#   -0.014360183849930763,
#   0.031158117577433586,
#   -0.0037462462205439806,
#   0.0255451500415802,
#   -0.047321006655693054,
#   0.0418924055993557,
#   0.026344075798988342,
#   -0.03517323359847069,
#   0.008250447921454906,
#   0.006637231912463903,
#   -0.005193019285798073,
#   -0.015241051092743874,
#   -0.02806483954191208,
#   -0.009561506099998951,
#   0.0100480318069458,
#   0.02212410606443882,
#   0.015179595910012722,
#   -0.06350438296794891,
#   0.013551015406847,
#   0.027327368035912514,
#   0.01081622950732708,
#   0.029314441606402397,
#   0.0019960347563028336,
#   0.010104366578161716,
#   0.0205569826066494,
#   -0.007466886192560196,
#   -0.04560024291276932,
#   -0.021366151049733162,
#   0.02476670779287815,
#   0.036299921572208405,
#   0.01792462356388569,
#   -0.007712709251791239,
#   0.009085223078727722,
#   0.011881465092301369,
#   0.04113445058465004,
#   0.02261575311422348,
#   -0.0038256268016994,
#   0.022841092199087143,
#   -0.0027168607339262962,
#   -0.010683075524866581,
#   -0.030871322378516197,
#   -0.030789382755756378,
#   -0.014472853392362595,
#   0.03281742334365845,
#   -0.17240415513515472,
#   -0.0030830353498458862,
#   -0.035337116569280624,
#   0.018682578578591347,
#   0.04301909729838371,
#   0.016398468986153603,
#   -0.009151800535619259,
#   -0.03675059974193573,
#   -0.03462012857198715,
#   0.00263235904276371,
#   -0.008317025378346443,
#   0.010836714878678322,
#   -0.042937155812978745,
#   0.01578391157090664,
#   0.00307023199275136,
#   -0.037385642528533936,
#   -0.00901864655315876,
#   0.01696181483566761,
#   -0.021960224956274033,
#   -0.04670644924044609,
#   0.016982300207018852,
#   0.030953263863921165,
#   -0.010928899049758911,
#   -0.04400239139795303,
#   0.014237272553145885,
#   -0.033759746700525284,
#   -0.019461018964648247,
#   -0.004716736730188131,
#   -0.017566131427884102,
#   -0.0035798032768070698,
#   0.0048729367554187775,
#   -0.029560264199972153,
#   0.0195839311927557,
#   0.03226432204246521,
#   -0.012926214374601841,
#   0.002127908868715167,
#   -0.021775856614112854,
#   0.0036258953623473644,
#   0.03896300867199898,
#   0.04666547849774361,
#   -0.004271181765943766,
#   -0.041564639657735825,
#   0.04445306584239006,
#   0.033206645399332047,
#   0.10242641717195511,
#   0.06055450066924095,
#   0.024992046877741814
# ]
